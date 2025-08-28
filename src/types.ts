export type ExchangeConfig = {
  exchange: string;
  enable_rate_limit?: boolean;
  default_type?: string;
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

export type Params = Record<string, any>;

export interface ExchangeLike {
  // Only the methods we call; others optional
  loadMarkets: (reload?: boolean, params?: Params) => Promise<any>;
  fetchMarkets: (params?: Params) => Promise<any>;
  fetchCurrencies: (params?: Params) => Promise<any>;
  fetchTicker: (symbol: string, params?: Params) => Promise<any>;
  fetchTickers: (symbols?: string[], params?: Params) => Promise<any>;
  fetchOrderBook: (symbol: string, limit?: number, params?: Params) => Promise<any>;
  fetchOHLCV: (symbol: string, timeframe?: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<number[][]>;
  fetchStatus?: (params?: Params) => Promise<any>;
  fetchTrades: (symbol: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<any>;
  fetchBalance: (params?: Params) => Promise<any>;
  fetchOrder: (id: string, symbol?: string, params?: Params) => Promise<any>;
  fetchOrders: (symbol?: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<any>;
  fetchOpenOrders: (symbol?: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<any>;
  fetchClosedOrders: (symbol?: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<any>;
  fetchMyTrades: (symbol?: string, since?: number | undefined, limit?: number | undefined, params?: Params) => Promise<any>;
  createOrder: (symbol: string, type: string, side: string, amount: number, price?: number, params?: Params) => Promise<any>;
  cancelOrder: (id: string, symbol?: string, params?: Params) => Promise<any>;
  deposit?: (code: string, amount: number, address: string, tag?: string, params?: Params) => Promise<any>;
  withdraw: (code: string, amount: number, address: string, tag?: string, params?: Params) => Promise<any>;
}
