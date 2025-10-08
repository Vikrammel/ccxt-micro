import type {
  Credentials,
  ExchangeConfig,
  ExchangeLike,
  JsonValue,
  Params,
  OrderBook,
  OhlcvTuple,
} from '../types';

const defaultOrderBook: OrderBook = {
  bids: [[65000, 1]],
  asks: [[65100, 2]],
};

const defaultOhlcv: readonly OhlcvTuple[] = [
  [1710000000000, 60000, 66000, 59000, 65000, 120] as const,
];

export function createExchange(_config: ExchangeConfig, _creds?: Credentials): ExchangeLike {
  const mock: ExchangeLike = {
    loadMarkets(_reload?: boolean, _p?: Params) {
      return Promise.resolve<JsonValue>({ loaded: true });
    },
    fetchMarkets(_p?: Params) {
      return Promise.resolve<JsonValue>([{ symbol: 'BTC/USDT' }]);
    },
    fetchCurrencies(_p?: Params) {
      return Promise.resolve<JsonValue>({ BTC: {}, USDT: {} });
    },
    fetchTicker(_symbol: string, _p?: Params) {
      return Promise.resolve<JsonValue>({ symbol: 'BTC/USDT', last: 65000 });
    },
    fetchTickers(_symbols?: readonly string[], _p?: Params) {
      return Promise.resolve<JsonValue>({
        'BTC/USDT': { last: 65000 },
        'ETH/USDT': { last: 3000 },
      });
    },
    fetchOrderBook(_symbol: string, _limit?: number, _p?: Params) {
      return Promise.resolve<OrderBook>(defaultOrderBook);
    },
    fetchOhlcv(
      _symbol: string,
      _timeframe?: string,
      _since?: number,
      _limit?: number,
      _p?: Params,
    ) {
      return Promise.resolve<readonly OhlcvTuple[]>(defaultOhlcv);
    },
    fetchStatus(_p?: Params) {
      return Promise.resolve<JsonValue>({ status: 'ok' });
    },
    fetchTrades(_symbol: string, _since?: number, _limit?: number, _p?: Params) {
      return Promise.resolve<JsonValue>([{ id: 't1', price: 65000, amount: 0.01 }]);
    },
    fetchBalance(_p?: Params) {
      return Promise.resolve<JsonValue>({ total: { USDT: 1000 } });
    },
    fetchOrder(_id: string, _symbol?: string, _p?: Params) {
      return Promise.resolve<JsonValue>({ id: 'o1', status: 'open' });
    },
    fetchOrders(_symbol?: string, _since?: number, _limit?: number, _p?: Params) {
      return Promise.resolve<JsonValue>([{ id: 'o1' }, { id: 'o2' }]);
    },
    fetchOpenOrders(_symbol?: string, _since?: number, _limit?: number, _p?: Params) {
      return Promise.resolve<JsonValue>([{ id: 'o1', status: 'open' }]);
    },
    fetchClosedOrders(_symbol?: string, _since?: number, _limit?: number, _p?: Params) {
      return Promise.resolve<JsonValue>([{ id: 'o3', status: 'closed' }]);
    },
    fetchMyTrades(_symbol?: string, _since?: number, _limit?: number, _p?: Params) {
      return Promise.resolve<JsonValue>([{ id: 'mt1', symbol: 'BTC/USDT' }]);
    },
    createOrder(
      _symbol: string,
      _type: string,
      _side: string,
      _amount: number,
      _price?: number,
      _p?: Params,
    ) {
      return Promise.resolve<JsonValue>({ id: 'newOrder' });
    },
    cancelOrder(_id: string, _symbol?: string, _p?: Params) {
      return Promise.resolve<JsonValue>({ id: 'o1', status: 'canceled' });
    },
    deposit(_code: string, _amount: number, _address: string, _tag?: string, _p?: Params) {
      return Promise.resolve<JsonValue>({ id: 'd1', status: 'ok' });
    },
    withdraw(_code: string, _amount: number, _address: string, _tag?: string, _p?: Params) {
      return Promise.resolve<JsonValue>({ id: 'w1', status: 'ok' });
    },
  };

  return mock;
}
