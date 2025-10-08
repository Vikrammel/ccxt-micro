import {
  CcxtServiceClient,
  BaseRequest,
  LoadMarketsRequest,
  GenericResponse,
  SymbolRequest,
  SymbolsRequest,
  OrderBookRequest,
  OHLCVRequest,
  TradesRequest,
  BalanceRequest,
  FetchOrderRequest,
  FetchOrdersRequest,
  CreateOrderRequest,
  CancelOrderRequest,
  DepositRequest,
  WithdrawRequest,
  FetchOHLCVResponse,
} from '../src/generated/ccxt';
import { Struct as StructMsg } from '../src/generated/google/protobuf/struct';
import { waitUntilReady, creds, structEmpty, valueTo } from './helpers';

/* Target from docker-compose: ccxt-micro:50051 */
const target = process.env.TARGET ?? 'localhost:50051';
const client = new CcxtServiceClient(target, creds());

async function ping(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = BaseRequest.fromPartial({
      config: { exchange: 'mockex', enableRateLimit: true },
      params: { value: StructMsg.fromJSON({}) },
    });
    client.fetchMarkets(req, (err, _res) => resolve(!err));
  });
}

beforeAll(async () => {
  await waitUntilReady(ping, { timeoutMs: 25000, intervalMs: 500 });
});

afterAll(async () => {
  client.close();
});

/* ------------------------------- loadMarkets ----------------------------------- */
test('loadMarkets returns loaded=true', async () => {
  const req = LoadMarketsRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    reload: true,
    params: { value: StructMsg.fromJSON({}) },
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.loadMarkets(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ loaded: boolean }>(res.data);
  expect(data.loaded).toBe(true);
});

/* ------------------------------- fetchMarkets ---------------------------------- */
test('fetchMarkets returns an array', async () => {
  const req = BaseRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    params: { value: StructMsg.fromJSON({}) },
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchMarkets(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ symbol: string }>>(res.data);
  expect(Array.isArray(data)).toBe(true);
  expect(data[0]?.symbol).toBe('BTC/USDT');
});

/* ------------------------------- fetchCurrencies ------------------------------- */
test('fetchCurrencies returns BTC & USDT keys', async () => {
  const req = BaseRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchCurrencies(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Record<string, unknown>>(res.data);
  expect(Object.prototype.hasOwnProperty.call(data, 'BTC')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(data, 'USDT')).toBe(true);
});

/* --------------------------------- fetchTicker -------------------------------- */
test('fetchTicker returns symbol BTC/USDT', async () => {
  const req = SymbolRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchTicker(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ symbol: string; last: number }>(res.data);
  expect(data.symbol).toBe('BTC/USDT');
  expect(typeof data.last).toBe('number');
});

/* -------------------------------- fetchTickers -------------------------------- */
test('fetchTickers returns map with BTC/USDT', async () => {
  const req = SymbolsRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbols: ['BTC/USDT', 'ETH/USDT'],
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchTickers(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Record<string, { last: number }>>(res.data);
  expect(data['BTC/USDT'].last).toBe(65000);
});

/* ------------------------------- fetchOrderBook -------------------------------- */
test('fetchOrderBook returns bids/asks arrays', async () => {
  const req = OrderBookRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    limit: 10,
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchOrderBook(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{
    bids: Array<readonly [number, number]>;
    asks: Array<readonly [number, number]>;
  }>(res.data);
  expect(Array.isArray(data.bids)).toBe(true);
  expect(Array.isArray(data.asks)).toBe(true);
  expect(data.bids.length).toBeGreaterThan(0);
});

/* -------------------------------- fetchOHLCV --------------------------------- */
test('fetchOHLCV returns candles with expected fields', async () => {
  const req = OHLCVRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    timeframe: '1h',
    since: 0,
    limit: 1,
    params: structEmpty(),
  });

  const res = await new Promise<FetchOHLCVResponse>((resolve, reject) =>
    client.fetchOhlcv(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  expect(res.candles.length).toBeGreaterThan(0);
  const c = res.candles[0]!;
  expect(typeof c.timestamp).toBe('number');
  expect(typeof c.open).toBe('number');
  expect(typeof c.high).toBe('number');
  expect(typeof c.low).toBe('number');
  expect(typeof c.close).toBe('number');
  expect(typeof c.volume).toBe('number');
});

/* -------------------------------- fetchStatus -------------------------------- */
test('fetchStatus returns ok', async () => {
  const req = BaseRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchStatus(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ status: string }>(res.data);
  expect(data.status).toBe('ok');
});

/* -------------------------------- fetchTrades -------------------------------- */
test('fetchTrades returns array of trades', async () => {
  const req = TradesRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    since: 0,
    limit: 1,
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchTrades(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ id: string; price: number; amount: number }>>(res.data);
  expect(Array.isArray(data)).toBe(true);
  expect(data[0]?.id).toBe('t1');
});

/* -------------------------------- fetchBalance ------------------------------- */
test('fetchBalance returns totals map with USDT', async () => {
  const req = BalanceRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchBalance(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ total: Record<string, number> }>(res.data);
  expect(data.total.USDT).toBe(1000);
});

/* --------------------------------- fetchOrder -------------------------------- */
test('fetchOrder returns id o1', async () => {
  const req = FetchOrderRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    id: 'o1',
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchOrder(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ id: string }>(res.data);
  expect(data.id).toBe('o1');
});

/* -------------------------------- fetchOrders -------------------------------- */
test('fetchOrders returns array', async () => {
  const req = FetchOrdersRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    since: 0,
    limit: 10,
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchOrders(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ id: string }>>(res.data);
  expect(Array.isArray(data)).toBe(true);
});

/* ------------------------------ fetchOpenOrders ------------------------------ */
test('fetchOpenOrders returns one open order', async () => {
  const req = FetchOrdersRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchOpenOrders(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ id: string; status: string }>>(res.data);
  expect(data[0]?.status).toBe('open');
});

/* ----------------------------- fetchClosedOrders ----------------------------- */
test('fetchClosedOrders returns one closed order', async () => {
  const req = FetchOrdersRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchClosedOrders(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ id: string; status: string }>>(res.data);
  expect(data[0]?.status).toBe('closed');
});

/* -------------------------------- fetchMyTrades ------------------------------- */
test('fetchMyTrades returns array with mt1', async () => {
  const req = FetchOrdersRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.fetchMyTrades(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<Array<{ id: string; symbol: string }>>(res.data);
  expect(data[0]?.id).toBe('mt1');
});

/* --------------------------------- createOrder -------------------------------- */
test('createOrder returns newOrder id', async () => {
  const req = CreateOrderRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    symbol: 'BTC/USDT',
    type: 'limit',
    side: 'buy',
    amount: 1,
    price: 1,
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.createOrder(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ id: string }>(res.data);
  expect(data.id).toBe('newOrder');
});

/* --------------------------------- cancelOrder -------------------------------- */
test('cancelOrder returns canceled', async () => {
  const req = CancelOrderRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    id: 'o1',
    symbol: 'BTC/USDT',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.cancelOrder(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ status: string }>(res.data);
  expect(data.status).toBe('canceled');
});

/* ------------------------------------ deposit --------------------------------- */
test('deposit returns id d1', async () => {
  const req = DepositRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    code: 'USDT',
    amount: 1,
    address: 'addr',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.deposit(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ id: string; status: string }>(res.data);
  expect(data.id).toBe('d1');
  expect(data.status).toBe('ok');
});

/* ----------------------------------- withdraw --------------------------------- */
test('withdraw returns id w1', async () => {
  const req = WithdrawRequest.fromPartial({
    config: { exchange: 'mockex', enableRateLimit: true },
    code: 'USDT',
    amount: 1,
    address: 'addr',
    params: structEmpty(),
  });

  const res = await new Promise<GenericResponse>((resolve, reject) =>
    client.withdraw(req, (err, out) => (err ? reject(err) : resolve(out!))),
  );

  const data = valueTo<{ id: string }>(res.data);
  expect(data.id).toBe('w1');
});
