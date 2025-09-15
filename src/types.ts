// JSON-compatible value (safe to serialize / send via google.protobuf.Value)
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [k: string]: JsonValue };

// CCXT OHLCV tuple: [timestamp, open, high, low, close, volume]
export type OhlcvTuple = readonly [number, number, number, number, number, number];

// Shape we emit to gRPC after mapping OHLCV arrays
export interface OhlcvEntry {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ExchangeConfig = {
  exchange: string;
  enable_rate_limit?: boolean;
  // keep flexibility, but hint common values
  default_type?: 'spot' | 'future' | 'margin' | 'swap' | (string & {});
  subaccount?: string;
};

export type Credentials = {
  api_key?: string;
  secret?: string;
  password?: string;
  uid?: string;
  login?: string;
  token?: string;
  twofa?: string;
};

// Free-form per-exchange params, but JSON-safe (no functions/undefined)
export type Params = Record<string, JsonValue>;

// Minimal order book typing (extend as needed)
export type OrderBook = {
  bids: Array<readonly [number, number]>;
  asks: Array<readonly [number, number]>;
  [k: string]: JsonValue; // allow extra CCXT fields
};

export interface ExchangeLike {
  // Only the methods we call; others optional
  loadMarkets: (reload?: boolean, params?: Params) => Promise<JsonValue>;
  fetchMarkets: (params?: Params) => Promise<JsonValue>;
  fetchCurrencies: (params?: Params) => Promise<JsonValue>;
  fetchTicker: (symbol: string, params?: Params) => Promise<JsonValue>;
  fetchTickers: (symbols?: readonly string[], params?: Params) => Promise<JsonValue>;
  fetchOrderBook: (symbol: string, limit?: number, params?: Params) => Promise<OrderBook>;
  fetchOhlcv: (
    symbol: string,
    timeframe?: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<readonly OhlcvTuple[]>;
  fetchStatus?: (params?: Params) => Promise<JsonValue>;
  fetchTrades: (
    symbol: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  fetchBalance: (params?: Params) => Promise<JsonValue>;
  fetchOrder: (id: string, symbol?: string, params?: Params) => Promise<JsonValue>;
  fetchOrders: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  fetchOpenOrders: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  fetchClosedOrders: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  fetchMyTrades: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  createOrder: (
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number,
    params?: Params,
  ) => Promise<JsonValue>;
  cancelOrder: (id: string, symbol?: string, params?: Params) => Promise<JsonValue>;
  deposit?: (
    code: string,
    amount: number,
    address: string,
    tag?: string,
    params?: Params,
  ) => Promise<JsonValue>;
  withdraw: (
    code: string,
    amount: number,
    address: string,
    tag?: string,
    params?: Params,
  ) => Promise<JsonValue>;
}
