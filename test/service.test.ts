// test/service.test.ts
import { serviceImpl } from '../src/service';
import type { ExchangeLike, JsonValue, Params, OrderBook, OhlcvTuple } from '../src/types';
import { isProtoValue } from '../src/utils';
import type { ServerUnaryCall, sendUnaryData, ServiceError } from '@grpc/grpc-js';

import {
  BaseRequest,
  LoadMarketsRequest,
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
  GenericResponse,
  FetchOHLCVResponse,
} from '../src/generated/ccxt';
import {
  Struct as StructMsg,
  Value as ValueMsg,
  ListValue as ListValueMsg,
} from '../src/generated/google/protobuf/struct';

// Plain-JSON shapes we expect after decoding google.protobuf.Value
type Loaded = { loaded: boolean };
type MarketsArr = Array<{ symbol: string }>;
type Currencies = Record<string, unknown>;
type Ticker = { symbol: string; last?: number };
type TickerMap = Record<string, { last: number }>;
type OrderBookJson = { bids: number[][]; asks: number[][] };
type StatusObj = { status: string };
type TradesArr = Array<{ id: string; price?: number; amount?: number; symbol?: string }>;
type BalanceJson = { total: Record<string, number> };
type OrderJson = { id: string; status?: string };
type IdOnly = { id: string };

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
  fetchOhlcv: jest.fn(
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
  const original = jest.requireActual('../src/exchangeFactory');
  return {
    ...original,
    createExchange: jest.fn((): ExchangeLike => mockExchange),
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

/* ----------------------------- Type guards ----------------------------- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function has<K extends string>(
  k: K,
  o: unknown,
): o is Record<K, unknown> & Record<string, unknown> {
  return isRecord(o) && k in o;
}
function isStructMsg(x: unknown): x is StructMsg {
  return isRecord(x) && 'fields' in x;
}
function isListValueMsg(x: unknown): x is ListValueMsg {
  return isRecord(x) && 'values' in x;
}

/* ---------------------- Flatten Value -> plain JSON --------------------- */
function valueMsgToPlain(v: ValueMsg): unknown {
  // NOTE: check explicit undefined to avoid narrowing mishaps
  if (v.nullValue !== undefined) return null;
  if (v.numberValue !== undefined) return v.numberValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue;

  // structValue may be a Struct message
  if (v.structValue !== undefined) {
    return structLikeToPlain(v.structValue);
  }

  // listValue may be a ListValue message OR already a Value[]
  if (v.listValue !== undefined) {
    return listLikeToPlain(v.listValue);
  }

  // Fallback: some generators keep a oneof wrapper-style; handle message-shaped objects
  if (has('structValue', v) && v.structValue !== undefined) {
    return structLikeToPlain(v.structValue);
  }
  if (has('listValue', v) && v.listValue !== undefined) {
    return listLikeToPlain(v.listValue);
  }

  return undefined;
}

function structLikeToPlain(s: StructMsg | Record<string, unknown>): Record<string, unknown> {
  // Normal case: Struct message { fields: Record<string, Value> }
  if (isStructMsg(s)) {
    const out: Record<string, unknown> = {};
    const fields = s.fields ?? {};
    for (const [k, vv] of Object.entries(fields)) {
      if (vv !== undefined) out[k] = valueMsgToPlain(vv as ValueMsg);
    }
    return out;
  }

  // Extremely defensive: if it's already a plain record, shallow copy
  if (isRecord(s)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) out[k] = v;
    return out;
  }

  return {};
}

function listLikeToPlain(lv: ListValueMsg | ValueMsg[] | unknown): unknown[] {
  if (Array.isArray(lv)) {
    // Already a Value[]
    return lv.map((x) => valueMsgToPlain(x));
  }
  if (isListValueMsg(lv)) {
    // Proper ListValue message
    const arr = lv.values ?? [];
    return arr.map((x) => valueMsgToPlain(x));
  }
  // Defensive: if someone passed an iterator function by mistake, just empty
  return [];
}

/** Convert google.protobuf.Value message to plain JSON for assertions. */
function valueTo<T>(v: ValueMsg | undefined): T {
  const msg: ValueMsg = v ?? ({ nullValue: 0 } as ValueMsg);
  return valueMsgToPlain(msg) as T;
}

/* --------------------------------- Fixtures -------------------------------- */

const base: BaseRequest = BaseRequest.fromPartial({
  config: { exchange: 'mockex', enableRateLimit: true },
  credentials: { apiKey: 'k', secret: 's' },
});

/* ---------------------------------- Tests ---------------------------------- */

describe('CcxtServiceImpl', () => {
  test('loadMarkets', async () => {
    const req: LoadMarketsRequest = LoadMarketsRequest.fromPartial({
      ...base,
      reload: true,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<LoadMarketsRequest, GenericResponse>(
      serviceImpl.loadMarkets,
      req,
    );
    expect(isProtoValue((res as GenericResponse).data)).toBe(true);
    expect(err).toBeNull();
    const data = valueTo<Loaded>((res as GenericResponse).data);
    expect(data.loaded).toBe(true);
  });

  test('fetchMarkets', async () => {
    const req: BaseRequest = BaseRequest.fromPartial({
      ...base,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<BaseRequest, GenericResponse>(serviceImpl.fetchMarkets, req);
    expect(err).toBeNull();
    const data = valueTo<MarketsArr>((res as GenericResponse).data);
    expect(Array.isArray(data)).toBe(true);
  });

  test('fetchCurrencies', async () => {
    const req: BaseRequest = BaseRequest.fromPartial({
      ...base,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<BaseRequest, GenericResponse>(
      serviceImpl.fetchCurrencies,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<Currencies>((res as GenericResponse).data);
    expect(Object.prototype.hasOwnProperty.call(data, 'BTC')).toBe(true);
  });

  test('fetchTicker', async () => {
    const req: SymbolRequest = SymbolRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<SymbolRequest, GenericResponse>(serviceImpl.fetchTicker, req);
    expect(err).toBeNull();
    const data = valueTo<Ticker>((res as GenericResponse).data);
    expect(data.symbol).toBe('BTC/USDT');
  });

  test('fetchTickers', async () => {
    const req: SymbolsRequest = SymbolsRequest.fromPartial({
      ...base,
      symbols: ['BTC/USDT', 'ETH/USDT'],
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<SymbolsRequest, GenericResponse>(
      serviceImpl.fetchTickers,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<TickerMap>((res as GenericResponse).data);
    expect(data['BTC/USDT'].last).toBe(65000);
  });

  test('fetchOrderBook', async () => {
    const req: OrderBookRequest = OrderBookRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      limit: 10,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<OrderBookRequest, GenericResponse>(
      serviceImpl.fetchOrderBook,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<OrderBookJson>((res as GenericResponse).data);
    expect(Array.isArray(data.bids)).toBe(true);
  });

  test('fetchOhlcv', async () => {
    const req: OHLCVRequest = OHLCVRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      limit: 1,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<OHLCVRequest, FetchOHLCVResponse>(
      serviceImpl.fetchOhlcv,
      req,
    );
    expect(err).toBeNull();
    const candles = (res as FetchOHLCVResponse).candles;
    expect(candles[0]).toHaveProperty('timestamp');
    expect(candles[0]).toHaveProperty('open');
  });

  test('fetchStatus', async () => {
    const req: BaseRequest = BaseRequest.fromPartial({ ...base });
    const { err, res } = await invoke<BaseRequest, GenericResponse>(serviceImpl.fetchStatus, req);
    expect(err).toBeNull();
    const data = valueTo<StatusObj>((res as GenericResponse).data);
    expect(data.status).toBe('ok');
  });

  test('fetchTrades', async () => {
    const req: TradesRequest = TradesRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      since: 0,
      limit: 1,
      params: { value: StructMsg.fromJSON({}) },
    });
    const { err, res } = await invoke<TradesRequest, GenericResponse>(serviceImpl.fetchTrades, req);
    expect(err).toBeNull();
    const data = valueTo<TradesArr>((res as GenericResponse).data);
    expect(Array.isArray(data)).toBe(true);
  });

  test('fetchBalance', async () => {
    const req: BalanceRequest = BalanceRequest.fromPartial({ ...base });
    const { err, res } = await invoke<BalanceRequest, GenericResponse>(
      serviceImpl.fetchBalance,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<BalanceJson>((res as GenericResponse).data);
    expect(data.total.USDT).toBe(1000);
  });

  test('fetchOrder', async () => {
    const req: FetchOrderRequest = FetchOrderRequest.fromPartial({
      ...base,
      id: 'o1',
      symbol: 'BTC/USDT',
    });
    const { err, res } = await invoke<FetchOrderRequest, GenericResponse>(
      serviceImpl.fetchOrder,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<OrderJson>((res as GenericResponse).data);
    expect(data.id).toBe('o1');
  });

  test('fetchOrders', async () => {
    const req: FetchOrdersRequest = FetchOrdersRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      since: 0,
      limit: 10,
    });
    const { err, res } = await invoke<FetchOrdersRequest, GenericResponse>(
      serviceImpl.fetchOrders,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<unknown[]>((res as GenericResponse).data);
    expect(Array.isArray(data)).toBe(true);
  });

  test('fetchOpenOrders', async () => {
    const req: FetchOrdersRequest = FetchOrdersRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
    });
    const { err, res } = await invoke<FetchOrdersRequest, GenericResponse>(
      serviceImpl.fetchOpenOrders,
      req,
    );
    expect(err).toBeNull();
    const arr = valueTo<Array<OrderJson>>((res as GenericResponse).data);
    expect(arr[0].status).toBe('open');
  });

  test('fetchClosedOrders', async () => {
    const req: FetchOrdersRequest = FetchOrdersRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
    });
    const { err, res } = await invoke<FetchOrdersRequest, GenericResponse>(
      serviceImpl.fetchClosedOrders,
      req,
    );
    expect(err).toBeNull();
    const arr = valueTo<Array<OrderJson>>((res as GenericResponse).data);
    expect(arr[0].status).toBe('closed');
  });

  test('fetchMyTrades', async () => {
    const req: FetchOrdersRequest = FetchOrdersRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
    });
    const { err, res } = await invoke<FetchOrdersRequest, GenericResponse>(
      serviceImpl.fetchMyTrades,
      req,
    );
    expect(err).toBeNull();
    const arr = valueTo<Array<{ id: string; symbol: string }>>((res as GenericResponse).data);
    expect(arr[0].id).toBe('mt1');
  });

  test('createOrder', async () => {
    const req: CreateOrderRequest = CreateOrderRequest.fromPartial({
      ...base,
      symbol: 'BTC/USDT',
      type: 'limit',
      side: 'buy',
      amount: 1,
      price: 1,
    });
    const { err, res } = await invoke<CreateOrderRequest, GenericResponse>(
      serviceImpl.createOrder,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<IdOnly>((res as GenericResponse).data);
    expect(data.id).toBe('newOrder');
  });

  test('cancelOrder', async () => {
    const req: CancelOrderRequest = CancelOrderRequest.fromPartial({
      ...base,
      id: 'o1',
      symbol: 'BTC/USDT',
    });
    const { err, res } = await invoke<CancelOrderRequest, GenericResponse>(
      serviceImpl.cancelOrder,
      req,
    );
    expect(err).toBeNull();
    const data = valueTo<{ status: string }>((res as GenericResponse).data);
    expect(data.status).toBe('canceled');
  });

  test('deposit (UNIMPLEMENTED)', async () => {
    const req: DepositRequest = DepositRequest.fromPartial({
      ...base,
      code: 'USDT',
      amount: 1,
      address: 'addr',
    });
    const { err } = await invoke<DepositRequest, GenericResponse>(serviceImpl.deposit, req);
    expect(err).not.toBeNull();
    expect((err as ServiceError).code).toBe(12); // status.UNIMPLEMENTED
  });

  test('withdraw', async () => {
    const req: WithdrawRequest = WithdrawRequest.fromPartial({
      ...base,
      code: 'USDT',
      amount: 1,
      address: 'addr',
    });
    const { err, res } = await invoke<WithdrawRequest, GenericResponse>(serviceImpl.withdraw, req);
    expect(err).toBeNull();
    const data = valueTo<IdOnly>((res as GenericResponse).data);
    expect(data.id).toBe('w1');
  });
});
