import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createExchange } from '../src/exchangeFactory';
import type { ExchangeLike, Params, OhlcvTuple, OrderBook, JsonValue } from '../src/types';

// ---- Typed capture for constructor options (no `any`) ----
type MockCtorOpts = Partial<{
  enableRateLimit: boolean;
  options: { defaultType?: string } & Record<string, JsonValue>;
  subaccount: string;
  apiKey: string;
  secret: string;
  password: string;
  uid: string;
  login: string;
  token: string;
  twofa: string;
}> &
  Record<string, JsonValue>;

// Augment the Node global for type-safe capture vars
declare global {
  var __fake_binance_last_opts: MockCtorOpts | undefined;
  var __fake_kraken_last_opts: MockCtorOpts | undefined;
}

// ---- Mock `ccxt` as a registry-like default export (typed) ----
// NOTE: jest.mock is hoisted, so define the mock inline.
jest.mock('ccxt', () => {
  // Minimal stub that satisfies ExchangeLike; returns trivial values.
  abstract class BaseMockExchange implements ExchangeLike {
    // Intentionally keep the constructor in subclasses to capture opts
    async loadMarkets(_reload?: boolean, _params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchMarkets(_params?: Params): Promise<JsonValue> {
      return [];
    }
    async fetchCurrencies(_params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchTicker(_symbol: string, _params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchTickers(_symbols?: readonly string[], _params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchOrderBook(_symbol: string, _limit?: number, _params?: Params): Promise<OrderBook> {
      return { bids: [], asks: [] };
    }
    async fetchOhlcv(
      _symbol: string,
      _timeframe?: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<readonly OhlcvTuple[]> {
      return [];
    }
    async fetchTrades(
      _symbol: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return [];
    }
    async fetchBalance(_params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchOrder(_id: string, _symbol?: string, _params?: Params): Promise<JsonValue> {
      return {};
    }
    async fetchOrders(
      _symbol?: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return [];
    }
    async fetchOpenOrders(
      _symbol?: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return [];
    }
    async fetchClosedOrders(
      _symbol?: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return [];
    }
    async fetchMyTrades(
      _symbol?: string,
      _since?: number,
      _limit?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return [];
    }
    async createOrder(
      _symbol: string,
      _type: string,
      _side: string,
      _amount: number,
      _price?: number,
      _params?: Params,
    ): Promise<JsonValue> {
      return {};
    }
    async cancelOrder(_id: string, _symbol?: string, _params?: Params): Promise<JsonValue> {
      return {};
    }
    async withdraw(
      _code: string,
      _amount: number,
      _address: string,
      _tag?: string,
      _params?: Params,
    ): Promise<JsonValue> {
      return {};
    }
  }

  class MockBinance extends BaseMockExchange {
    constructor(opts?: MockCtorOpts) {
      super();
      globalThis.__fake_binance_last_opts = opts;
    }
  }

  class MockKraken extends BaseMockExchange {
    constructor(opts?: MockCtorOpts) {
      super();
      globalThis.__fake_kraken_last_opts = opts;
    }
  }

  return {
    __esModule: true,
    default: {
      binance: MockBinance,
      kraken: MockKraken,
    },
  };
});

// Local copies of config/creds types (keeps the test focused)
type ExchangeConfig = {
  exchange: string;
  enable_rate_limit?: boolean;
  default_type?: 'spot' | 'future' | 'margin' | 'swap' | (string & {});
  subaccount?: string;
};

type Credentials = {
  api_key?: string;
  secret?: string;
  password?: string;
  uid?: string;
  login?: string;
  token?: string;
  twofa?: string;
};

describe('createExchange (Jest, no any)', () => {
  beforeEach(() => {
    global.__fake_binance_last_opts = undefined;
    global.__fake_kraken_last_opts = undefined;
    jest.clearAllMocks();
  });

  test('throws for unsupported exchange key', () => {
    const cfg: ExchangeConfig = { exchange: 'does-not-exist' };
    expect(() => createExchange(cfg)).toThrowError(/Unsupported exchange: does-not-exist/);
  });

  test('constructs the correct ccxt class based on config.exchange', () => {
    const binanceCfg: ExchangeConfig = { exchange: 'binance' };
    const krakenCfg: ExchangeConfig = { exchange: 'kraken' };

    createExchange(binanceCfg);
    createExchange(krakenCfg);

    // Ensure each constructor recorded its options independently
    expect(global.__fake_binance_last_opts).toBeDefined();
    expect(global.__fake_kraken_last_opts).toBeDefined();

    // Ensure distinct objects (i.e., correct ctor selection)
    expect(global.__fake_binance_last_opts).not.toBe(global.__fake_kraken_last_opts);
  });

  test('enables rate limit by default and maps enable_rate_limit -> enableRateLimit', () => {
    const cfg: ExchangeConfig = { exchange: 'binance' }; // default true
    createExchange(cfg);

    expect(global.__fake_binance_last_opts).toMatchObject({
      enableRateLimit: true,
    });
  });

  test('respects enable_rate_limit=false', () => {
    const cfg: ExchangeConfig = { exchange: 'binance', enable_rate_limit: false };
    createExchange(cfg);

    expect(global.__fake_binance_last_opts).toMatchObject({
      enableRateLimit: false,
    });
  });

  test('maps default_type to options.defaultType', () => {
    const cfg: ExchangeConfig = { exchange: 'binance', default_type: 'swap' };
    createExchange(cfg);

    expect(global.__fake_binance_last_opts).toMatchObject({
      options: { defaultType: 'swap' },
    });
  });

  test('includes subaccount when provided', () => {
    const cfg: ExchangeConfig = { exchange: 'binance', subaccount: 'research-desk' };
    createExchange(cfg);

    expect(global.__fake_binance_last_opts).toMatchObject({
      subaccount: 'research-desk',
    });
  });

  test('maps credentials fields to ccxt-recognized keys', () => {
    const cfg: ExchangeConfig = { exchange: 'binance' };
    const creds: Credentials = {
      api_key: 'k',
      secret: 's',
      password: 'p',
      uid: 'u',
      login: 'l',
      token: 't',
      twofa: '2f',
    };

    createExchange(cfg, creds);

    expect(global.__fake_binance_last_opts).toMatchObject({
      apiKey: 'k',
      secret: 's',
      password: 'p',
      uid: 'u',
      login: 'l',
      token: 't',
      twofa: '2f',
    });
  });

  test('omits credential keys that are not provided', () => {
    const cfg: ExchangeConfig = { exchange: 'binance' };
    const creds: Credentials = { api_key: 'only-api-key' };

    createExchange(cfg, creds);

    expect(global.__fake_binance_last_opts).toBeDefined();
    expect(global.__fake_binance_last_opts).toHaveProperty('apiKey', 'only-api-key');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('secret');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('password');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('uid');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('login');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('token');
    expect(global.__fake_binance_last_opts).not.toHaveProperty('twofa');
  });

  test('merges defaultType into an existing options object (defensive check)', () => {
    const cfg: ExchangeConfig = { exchange: 'binance', default_type: 'spot' };
    createExchange(cfg);

    expect(global.__fake_binance_last_opts?.options).toEqual(
      expect.objectContaining({ defaultType: 'spot' }),
    );
  });
});
