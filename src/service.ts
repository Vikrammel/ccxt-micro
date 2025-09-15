import type { sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import { createExchange } from './exchangeFactory';
import { asGrpcValue, mapCcxtErrorToGrpc, toOhlcv } from './utils';
import type {
  Credentials,
  ExchangeConfig,
  ExchangeLike,
  JsonValue,
  OhlcvEntry,
  Params,
} from './types';

/* ------------------------ Request / Response typings ----------------------- */

class InvalidArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArguments';
  }
}

type StructMessage = { value?: Params };

type BaseReq = {
  config: ExchangeConfig;
  credentials?: Credentials;
  params?: StructMessage;
};

type LoadMarketsRequest = BaseReq & { reload?: boolean };

type SymbolRequest = BaseReq & { symbol: string };
type SymbolsRequest = BaseReq & { symbols?: string[] };

type OrderBookRequest = BaseReq & { symbol: string; limit?: number };

type OHLCVRequest = BaseReq & {
  symbol: string;
  timeframe?: string;
  since?: number;
  limit?: number;
};

type TradesRequest = BaseReq & {
  symbol: string;
  since?: number;
  limit?: number;
};

type FetchOrderRequest = BaseReq & { id: string; symbol?: string };
type FetchOrdersRequest = BaseReq & { symbol?: string; since?: number; limit?: number };

type CreateOrderRequest = BaseReq & {
  symbol: string;
  type: string;
  side: string;
  amount: number;
  price?: number;
};

type CancelOrderRequest = BaseReq & { id: string; symbol?: string };

type TransferRequest = BaseReq & {
  code: string;
  amount: number;
  address: string;
  tag?: string;
};

type GenericResponse = { data: JsonValue };
type FetchOHLCVResponse = { candles: OhlcvEntry[] };

/* --------------------------------- Helpers -------------------------------- */

function paramsOf(req: { params?: StructMessage }): Params | undefined {
  return req.params?.value;
}

function ensureExchange<R extends BaseReq>(call: ServerUnaryCall<R, unknown>): ExchangeLike {
  const { config, credentials } = call.request;
  if (!config?.exchange) {
    throw new InvalidArgumentsError('config.exchange is required');
  }
  return createExchange(config, credentials);
}

function ok<T>(cb: sendUnaryData<T>, payload: T) {
  cb(null, payload);
}

function fail<T>(cb: sendUnaryData<T>, err: unknown) {
  const mapped = mapCcxtErrorToGrpc(err);
  cb({ code: mapped.code, message: mapped.message } as never, null as never);
}

/* --------------------------------- Service -------------------------------- */

export class CcxtServiceImpl {
  loadMarkets = async (
    call: ServerUnaryCall<LoadMarketsRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.loadMarkets(Boolean(call.request.reload), paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchMarkets = async (
    call: ServerUnaryCall<BaseReq, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchMarkets(paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchCurrencies = async (
    call: ServerUnaryCall<BaseReq, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchCurrencies(paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchTicker = async (
    call: ServerUnaryCall<SymbolRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchTicker(call.request.symbol, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchTickers = async (
    call: ServerUnaryCall<SymbolsRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const syms =
        call.request.symbols && call.request.symbols.length ? call.request.symbols : undefined;
      const data = await ex.fetchTickers(syms, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchOrderBook = async (
    call: ServerUnaryCall<OrderBookRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchOrderBook(
        call.request.symbol,
        call.request.limit,
        paramsOf(call.request),
      );
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchOHLCV = async (
    call: ServerUnaryCall<OHLCVRequest, FetchOHLCVResponse>,
    cb: sendUnaryData<FetchOHLCVResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, timeframe, since, limit } = call.request;
      const rows = await ex.fetchOHLCV(symbol, timeframe, since, limit, paramsOf(call.request));
      ok(cb, { candles: toOhlcv(rows) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchStatus = async (
    call: ServerUnaryCall<BaseReq, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      if (!ex.fetchStatus) {
        return cb(
          {
            code: status.UNIMPLEMENTED,
            message: 'fetchStatus not supported by this exchange',
          } as never,
          null as never,
        );
      }
      const data = await ex.fetchStatus(paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchTrades = async (
    call: ServerUnaryCall<TradesRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, since, limit } = call.request;
      const data = await ex.fetchTrades(symbol, since, limit, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchBalance = async (
    call: ServerUnaryCall<BaseReq, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchBalance(paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchOrder = async (
    call: ServerUnaryCall<FetchOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.fetchOrder(
        call.request.id,
        call.request.symbol,
        paramsOf(call.request),
      );
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchOrders = async (
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, since, limit } = call.request;
      const data = await ex.fetchOrders(symbol, since, limit, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchOpenOrders = async (
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, since, limit } = call.request;
      const data = await ex.fetchOpenOrders(symbol, since, limit, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchClosedOrders = async (
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, since, limit } = call.request;
      const data = await ex.fetchClosedOrders(symbol, since, limit, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  fetchMyTrades = async (
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, since, limit } = call.request;
      const data = await ex.fetchMyTrades(symbol, since, limit, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  createOrder = async (
    call: ServerUnaryCall<CreateOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { symbol, type, side, amount, price } = call.request;
      const data = await ex.createOrder(symbol, type, side, amount, price, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  cancelOrder = async (
    call: ServerUnaryCall<CancelOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const data = await ex.cancelOrder(
        call.request.id,
        call.request.symbol,
        paramsOf(call.request),
      );
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  deposit = async (
    call: ServerUnaryCall<TransferRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      if (!ex.deposit) {
        return cb(
          {
            code: status.UNIMPLEMENTED,
            message: 'deposit not supported by this exchange',
          } as never,
          null as never,
        );
      }
      const { code, amount, address, tag } = call.request;
      const data = await ex.deposit(code, amount, address, tag, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };

  withdraw = async (
    call: ServerUnaryCall<TransferRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) => {
    try {
      const ex = ensureExchange(call);
      const { code, amount, address, tag } = call.request;
      const data = await ex.withdraw(code, amount, address, tag, paramsOf(call.request));
      ok(cb, { data: asGrpcValue(data) });
    } catch (err) {
      fail(cb, err);
    }
  };
}

export const serviceImpl = new CcxtServiceImpl();
