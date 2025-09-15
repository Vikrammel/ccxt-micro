// test/service.test.ts
import { serviceImpl } from '../src/service';
import type {
  ExchangeConfig,
  Credentials,
  ExchangeLike,
  JsonValue,
  Params,
  OhlcvEntry,
  OrderBook,
  OhlcvTuple,
} from '../src/types';
import type { ServerUnaryCall, sendUnaryData, ServiceError } from '@grpc/grpc-js';

/* ----------------------------- Exchange mock ------------------------------ */

const mockExchange: ExchangeLike = {
  loadMarkets: jest.fn(
    async (_reload?: boolean, _p?: Params): Promise<JsonValue> => ({ loaded: true }),
  ),
  fetchMarkets: jest.fn(async (_p?: Params): Promise<JsonValue> => [{ symbol: 'BTC/USDT' }]),
  fetchCurrencies: jest.fn(async (_p?: Params): Promise<JsonValue> => ({ BTC: {}, USDT: {} })),
  fetchTicker: jest.fn(
    async (_s: string, _p?: Params): Promise<JsonValue> => ({ symbol: 'BTC/USDT', last: 65000 }),
  ),
  fetchTickers: jest.fn(
    async (_ss?: readonly string[], _p?: Params): Promise<JsonValue> => ({
      'BTC/USDT': { last: 65000 },
      'ETH/USDT': { last: 3000 },
    }),
  ),
  fetchOrderBook: jest.fn(
    async (_s: string, _l?: number, _p?: Params): Promise<OrderBook> => ({
      bids: [[65000, 1]] as Array<readonly [number, number]>,
      asks: [[65100, 2]] as Array<readonly [number, number]>,
    }),
  ),
  fetchOHLCV: jest.fn(
    async (_s: string): Promise<readonly OhlcvTuple[]> => [
      [1710000000000, 60000, 66000, 59000, 65000, 120] as const,
    ],
  ),
  fetchStatus: jest.fn(async (_p?: Params): Promise<JsonValue> => ({ status: 'ok' })),
  fetchTrades: jest.fn(
    async (_s: string, _since?: number, _limit?: number, _p?: Params): Promise<JsonValue> => [
      { id: 't1', price: 65000, amount: 0.01 },
    ],
  ),
  fetchBalance: jest.fn(async (_p?: Params): Promise<JsonValue> => ({ total: { USDT: 1000 } })),
  fetchOrder: jest.fn(
    async (_id: string, _sym?: string, _p?: Params): Promise<JsonValue> => ({
      id: 'o1',
      status: 'open',
    }),
  ),
  fetchOrders: jest.fn(
    async (_sym?: string, _since?: number, _limit?: number, _p?: Params): Promise<JsonValue> => [
      { id: 'o1' },
      { id: 'o2' },
    ],
  ),
  fetchOpenOrders: jest.fn(async (): Promise<JsonValue> => [{ id: 'o1', status: 'open' }]),
  fetchClosedOrders: jest.fn(async (): Promise<JsonValue> => [{ id: 'o3', status: 'closed' }]),
  fetchMyTrades: jest.fn(async (): Promise<JsonValue> => [{ id: 'mt1', symbol: 'BTC/USDT' }]),
  createOrder: jest.fn(async (): Promise<JsonValue> => ({ id: 'newOrder' })),
  cancelOrder: jest.fn(async (): Promise<JsonValue> => ({ id: 'o1', status: 'canceled' })),
  // deposit intentionally omitted to exercise UNIMPLEMENTED path
  withdraw: jest.fn(async (): Promise<JsonValue> => ({ id: 'w1', status: 'ok' })),
};

jest.mock('../src/exchangeFactory', () => {
  return {
    createExchange: jest.fn(
      (_config: ExchangeConfig, _creds?: Credentials): ExchangeLike => mockExchange,
    ),
  };
});

/* ----------------------------- gRPC test utils ---------------------------- */

type Unary<Req, Res> = (
  call: ServerUnaryCall<Req, Res>,
  cb: sendUnaryData<Res>,
) => void | Promise<void>;

function invoke<Req extends object, Res>(
  handler: Unary<Req, Res>,
  request: Req,
): Promise<{ err: ServiceError | null; res: Res | null }> {
  return new Promise((resolve) => {
    const call = { request } as unknown as ServerUnaryCall<Req, Res>;
    handler(call, (err, res) => {
      resolve({
        err: (err ?? null) as ServiceError | null,
        res: (res ?? null) as Res | null,
      });
    });
  });
}

/* --------------------------------- Fixtures -------------------------------- */

const base = {
  config: { exchange: 'mockex', enable_rate_limit: true },
  credentials: { api_key: 'k', secret: 's' },
  params: { value: {} as Params },
} as const;

/* ---------------------------------- Tests ---------------------------------- */

describe('CcxtServiceImpl', () => {
  test('loadMarkets', async () => {
    const req = { ...base, reload: true };
    const { err, res } = await invoke(serviceImpl.loadMarkets, req);
    expect(err).toBeNull();
    expect((res as { data: JsonValue }).data).toHaveProperty('loaded', true);
  });

  test('fetchMarkets', async () => {
    const { err, res } = await invoke(serviceImpl.fetchMarkets, base);
    expect(err).toBeNull();
    expect(Array.isArray((res as { data: JsonValue }).data)).toBe(true);
  });

  test('fetchCurrencies', async () => {
    const { err, res } = await invoke(serviceImpl.fetchCurrencies, base);
    expect(err).toBeNull();
    const data = (res as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('BTC');
  });

  test('fetchTicker', async () => {
    const req = { ...base, symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.fetchTicker, req);
    expect(err).toBeNull();
    const data = (res as { data: { symbol: string } }).data;
    expect(data.symbol).toBe('BTC/USDT');
  });

  test('fetchTickers', async () => {
    const req = { ...base, symbols: ['BTC/USDT', 'ETH/USDT'] };
    const { err, res } = await invoke(serviceImpl.fetchTickers, req);
    expect(err).toBeNull();
    const data = (res as { data: Record<string, { last: number }> }).data;
    expect(data['BTC/USDT'].last).toBe(65000);
  });

  test('fetchOrderBook', async () => {
    const req = { ...base, symbol: 'BTC/USDT', limit: 10 };
    const { err, res } = await invoke(serviceImpl.fetchOrderBook, req);
    expect(err).toBeNull();
    const data = (res as { data: OrderBook }).data;
    expect(Array.isArray(data.bids)).toBe(true);
  });

  test('fetchOHLCV', async () => {
    const req = { ...base, symbol: 'BTC/USDT', timeframe: '1h', since: 0, limit: 1 };
    const { err, res } = await invoke(serviceImpl.fetchOHLCV, req);
    expect(err).toBeNull();
    const candles = (res as { candles: OhlcvEntry[] }).candles;
    expect(candles[0]).toHaveProperty('timestamp');
    expect(candles[0]).toHaveProperty('open');
  });

  test('fetchStatus', async () => {
    const { err, res } = await invoke(serviceImpl.fetchStatus, base);
    expect(err).toBeNull();
    const data = (res as { data: { status: string } }).data;
    expect(data.status).toBe('ok');
  });

  test('fetchTrades', async () => {
    const req = { ...base, symbol: 'BTC/USDT', since: 0, limit: 1 };
    const { err, res } = await invoke(serviceImpl.fetchTrades, req);
    expect(err).toBeNull();
    expect(Array.isArray((res as { data: JsonValue }).data)).toBe(true);
  });

  test('fetchBalance', async () => {
    const { err, res } = await invoke(serviceImpl.fetchBalance, base);
    expect(err).toBeNull();
    const data = (res as { data: { total: Record<string, number> } }).data;
    expect(data.total.USDT).toBe(1000);
  });

  test('fetchOrder', async () => {
    const req = { ...base, id: 'o1', symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.fetchOrder, req);
    expect(err).toBeNull();
    expect((res as { data: { id: string } }).data.id).toBe('o1');
  });

  test('fetchOrders', async () => {
    const req = { ...base, symbol: 'BTC/USDT', since: 0, limit: 10 };
    const { err, res } = await invoke(serviceImpl.fetchOrders, req);
    expect(err).toBeNull();
    expect(Array.isArray((res as { data: unknown[] }).data)).toBe(true);
  });

  test('fetchOpenOrders', async () => {
    const req = { ...base, symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.fetchOpenOrders, req);
    expect(err).toBeNull();
    const arr = (res as { data: Array<{ id: string; status: string }> }).data;
    expect(arr[0].status).toBe('open');
  });

  test('fetchClosedOrders', async () => {
    const req = { ...base, symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.fetchClosedOrders, req);
    expect(err).toBeNull();
    const arr = (res as { data: Array<{ id: string; status: string }> }).data;
    expect(arr[0].status).toBe('closed');
  });

  test('fetchMyTrades', async () => {
    const req = { ...base, symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.fetchMyTrades, req);
    expect(err).toBeNull();
    const arr = (res as { data: Array<{ id: string; symbol: string }> }).data;
    expect(arr[0].id).toBe('mt1');
  });

  test('createOrder', async () => {
    const req = { ...base, symbol: 'BTC/USDT', type: 'limit', side: 'buy', amount: 1, price: 1 };
    const { err, res } = await invoke(serviceImpl.createOrder, req);
    expect(err).toBeNull();
    expect((res as { data: { id: string } }).data.id).toBe('newOrder');
  });

  test('cancelOrder', async () => {
    const req = { ...base, id: 'o1', symbol: 'BTC/USDT' };
    const { err, res } = await invoke(serviceImpl.cancelOrder, req);
    expect(err).toBeNull();
    expect((res as { data: { status: string } }).data.status).toBe('canceled');
  });

  test('deposit (UNIMPLEMENTED)', async () => {
    const req = { ...base, code: 'USDT', amount: 1, address: 'addr' };
    const { err } = await invoke(serviceImpl.deposit, req);
    expect(err).not.toBeNull();
    expect((err as ServiceError).code).toBe(12); // status.UNIMPLEMENTED
  });

  test('withdraw', async () => {
    const req = { ...base, code: 'USDT', amount: 1, address: 'addr' };
    const { err, res } = await invoke(serviceImpl.withdraw, req);
    expect(err).toBeNull();
    expect((res as { data: { id: string } }).data.id).toBe('w1');
  });
});
