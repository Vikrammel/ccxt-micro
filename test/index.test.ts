// index.test.ts
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/* -------------------- Typed mocks (no `any`) -------------------- */

type BindCallback = (err: Error | null, boundPort: number) => void;
type TryShutdownCallback = (err?: Error | null) => void;

class ServerMock {
  static lastInstance: ServerMock | undefined;
  static lastBindAddr: string | undefined;
  static lastCreds: object | undefined;
  static bindCallback: BindCallback | undefined;

  readonly addService = jest.fn<(svc: unknown, impl: unknown) => void>();

  readonly bindAsync = jest
    .fn<(addr: string, creds: object, cb: BindCallback) => void>()
    .mockImplementation((addr: string, creds: object, cb: BindCallback) => {
      ServerMock.lastBindAddr = addr;
      ServerMock.lastCreds = creds;
      ServerMock.bindCallback = cb;
    });

  readonly tryShutdown = jest
    .fn<(cb: TryShutdownCallback) => void>()
    .mockImplementation((_cb: TryShutdownCallback) => {
      /* test triggers manually */
    });

  readonly forceShutdown = jest.fn<() => void>();

  constructor() {
    ServerMock.lastInstance = this;
  }
}

const ServerCredentialsMock = {
  createInsecure: jest.fn<() => unknown>().mockImplementation(() => ({ tag: 'insecure' }) as const),
};

// Provide a tiny token we can assert against
const CcxtServiceServiceMock: unknown = { svc: 'Ccxt' } as const;
const serviceImplMock: unknown = { impl: 'service' } as const;

/* -------------------- Module mocks -------------------- */

jest.mock('@grpc/grpc-js', () => {
  return {
    __esModule: true,
    Server: ServerMock,
    ServerCredentials: ServerCredentialsMock,
  };
});

jest.mock('dotenv', () => {
  return {
    __esModule: true,
    default: { config: jest.fn<() => unknown>(() => ({})) },
  };
});

jest.mock('../src/generated/ccxt', () => {
  return {
    __esModule: true,
    CcxtServiceService: CcxtServiceServiceMock,
  };
});

jest.mock('../src/service', () => {
  return {
    __esModule: true,
    serviceImpl: serviceImplMock,
  };
});

/* -------------------- Test helpers -------------------- */

async function importMain(): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    await import('../src/index');
  });
}

function triggerBindSuccess(port: number): void {
  const cb = ServerMock.bindCallback;
  expect(cb).toBeDefined();
  if (cb) cb(null, port);
}

function triggerBindError(err: Error): void {
  const cb = ServerMock.bindCallback;
  expect(cb).toBeDefined();
  if (cb) cb(err, 0);
}

/* -------------------- Spies for process / console -------------------- */

let exitSpy: ReturnType<typeof jest.spyOn>;
let onSpy: ReturnType<typeof jest.spyOn>;
let logSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  // Reset static tracking
  ServerMock.lastInstance = undefined;
  ServerMock.lastBindAddr = undefined;
  ServerMock.lastCreds = undefined;
  ServerMock.bindCallback = undefined;

  jest.clearAllMocks();

  // Mock process.exit (never) safely
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(((
    code?: string | number | null | undefined,
  ): never => {
    throw new Error(`process.exit:${String(code)}`);
  }) as unknown as typeof process.exit);

  onSpy = jest.spyOn(process, 'on');
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

/* -------------------- Tests -------------------- */

describe('index.ts server bootstrap', () => {
  test('binds on default port 50051 when PORT is unset', async () => {
    delete process.env.PORT;
    await importMain();

    expect(ServerMock.lastBindAddr).toBe('0.0.0.0:50051');
    expect(ServerCredentialsMock.createInsecure).toHaveBeenCalledTimes(1);

    // Simulate success so the log happens
    triggerBindSuccess(50051);
    expect(logSpy).toHaveBeenCalledWith('ccxt-micro gRPC server listening on 0.0.0.0:50051');
  });

  test('uses PORT from environment when provided', async () => {
    process.env.PORT = '6000';
    await importMain();

    expect(ServerMock.lastBindAddr).toBe('0.0.0.0:6000');
  });

  test('adds service implementation to server', async () => {
    await importMain();

    const server = ServerMock.lastInstance;
    expect(server).toBeDefined();
    if (server) {
      expect(server.addService).toHaveBeenCalledWith(CcxtServiceServiceMock, serviceImplMock);
    }
  });

  test('on bind error: logs and exits with code 1', async () => {
    await importMain();

    const err = new Error('bind failed');
    try {
      triggerBindError(err);
    } catch (_e) {
      // process.exit throws in our spy; ignore
    }

    expect(errorSpy).toHaveBeenCalled();
    const firstErrorArg = errorSpy.mock.calls[0]?.[0];
    expect(firstErrorArg).toBe('Failed to bind:');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('graceful shutdown on SIGINT: tryShutdown success -> exit(0)', async () => {
    await importMain();

    // Find the registered SIGINT handler
    const sigintCall = onSpy.mock.calls.find((c: ReadonlyArray<unknown>) => c[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();

    const handler = (sigintCall?.[1] ?? undefined) as ((...args: unknown[]) => unknown) | undefined;
    expect(typeof handler).toBe('function');

    const server = ServerMock.lastInstance;
    expect(server).toBeDefined();

    if (server && handler) {
      server.tryShutdown.mockImplementation((cb: TryShutdownCallback) => cb(null));

      try {
        handler('SIGINT');
      } catch {
        // exit throws in our spy; ignore
      }

      expect(logSpy).toHaveBeenCalledWith('\nReceived SIGINT, shutting down gRPC server...');
      expect(server.tryShutdown).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    }
  });

  test('graceful shutdown on SIGTERM: tryShutdown error -> forceShutdown then exit(0)', async () => {
    await importMain();

    const sigtermCall = onSpy.mock.calls.find((c: ReadonlyArray<unknown>) => c[0] === 'SIGTERM');
    expect(sigtermCall).toBeDefined();

    const handler = (sigtermCall?.[1] ?? undefined) as
      | ((...args: unknown[]) => unknown)
      | undefined;
    const server = ServerMock.lastInstance;
    expect(server).toBeDefined();

    if (server && handler) {
      server.tryShutdown.mockImplementation((cb: TryShutdownCallback) => cb(new Error('boom')));

      try {
        handler('SIGTERM');
      } catch {
        // exit throws; ignore
      }

      expect(logSpy).toHaveBeenCalledWith('\nReceived SIGTERM, shutting down gRPC server...');
      expect(server.tryShutdown).toHaveBeenCalled();
      expect(server.forceShutdown).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled(); // logs the shutdown error
      expect(exitSpy).toHaveBeenCalledWith(0);
    }
  });
});
