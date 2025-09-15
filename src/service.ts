// src/service.ts
import type { sendUnaryData, ServerUnaryCall, ServiceError } from '@grpc/grpc-js';
import { status, Metadata } from '@grpc/grpc-js';
import { createExchange } from './exchangeFactory';
import { asGrpcValue, mapCcxtErrorToGrpc, toOhlcv, structToParams, jsonToValue } from './utils';
import type { Credentials, ExchangeConfig } from './types';

import {
  CcxtServiceServer,
  GenericResponse,
  FetchOHLCVResponse,
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
  BaseRequest,
} from './generated/ccxt';

/* --------------------------------- Helpers -------------------------------- */

class InvalidArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArguments';
  }
}

function toServiceError(err: unknown): ServiceError {
  const { code, message } = mapCcxtErrorToGrpc(err);
  return {
    name: 'ServiceError',
    message,
    code: code as status,
    details: message,
    metadata: new Metadata(),
  };
}

function ensureExchange<RequestT extends { config?: unknown; credentials?: unknown }>(
  call: ServerUnaryCall<RequestT, unknown>,
) {
  const cfg = call.request.config as ExchangeConfig | undefined;
  const creds = call.request.credentials as Credentials | undefined;
  if (!cfg?.exchange) {
    throw new InvalidArgumentsError('config.exchange is required');
  }
  return createExchange(cfg, creds);
}

/* --------------------------------- Service -------------------------------- */

export const serviceImpl: CcxtServiceServer = {
  loadMarkets(
    call: ServerUnaryCall<LoadMarketsRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.loadMarkets(Boolean(call.request.reload), params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchMarkets(
    call: ServerUnaryCall<BaseRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchMarkets(params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchCurrencies(
    call: ServerUnaryCall<BaseRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchCurrencies(params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchTicker(
    call: ServerUnaryCall<SymbolRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchTicker(call.request.symbol, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchTickers(
    call: ServerUnaryCall<SymbolsRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const syms = call.request.symbols?.length ? call.request.symbols : undefined;
      ex.fetchTickers(syms, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchOrderBook(
    call: ServerUnaryCall<OrderBookRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchOrderBook(call.request.symbol, call.request.limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchOhlcv(
    call: ServerUnaryCall<OHLCVRequest, FetchOHLCVResponse>,
    cb: sendUnaryData<FetchOHLCVResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, timeframe, since, limit } = call.request;
      ex.fetchOhlcv(symbol, timeframe, since, limit, params)
        .then((rows) => cb(null, { candles: toOhlcv(rows) }))
        .catch((e: unknown) => cb(toServiceError(e), null as unknown as FetchOHLCVResponse));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchStatus(
    call: ServerUnaryCall<BaseRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      if (!ex.fetchStatus) {
        cb(
          {
            name: 'ServiceError',
            message: 'fetchStatus not supported by this exchange',
            code: status.UNIMPLEMENTED,
            metadata: new Metadata(),
            details: 'fetchStatus not supported by this exchange',
          },
          null,
        );
        return;
      }
      const params = structToParams(call.request.params?.value);
      ex.fetchStatus(params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchTrades(
    call: ServerUnaryCall<TradesRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, since, limit } = call.request;
      ex.fetchTrades(symbol, since, limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchBalance(
    call: ServerUnaryCall<BalanceRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchBalance(params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchOrder(
    call: ServerUnaryCall<FetchOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.fetchOrder(call.request.id, call.request.symbol, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchOrders(
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, since, limit } = call.request;
      ex.fetchOrders(symbol, since, limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchOpenOrders(
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, since, limit } = call.request;
      ex.fetchOpenOrders(symbol, since, limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchClosedOrders(
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, since, limit } = call.request;
      ex.fetchClosedOrders(symbol, since, limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  fetchMyTrades(
    call: ServerUnaryCall<FetchOrdersRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, since, limit } = call.request;
      ex.fetchMyTrades(symbol, since, limit, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  createOrder(
    call: ServerUnaryCall<CreateOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { symbol, type, side, amount, price } = call.request;
      ex.createOrder(symbol, type, side, amount, price, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  cancelOrder(
    call: ServerUnaryCall<CancelOrderRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      ex.cancelOrder(call.request.id, call.request.symbol, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  deposit(
    call: ServerUnaryCall<DepositRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      if (!ex.deposit) {
        cb(
          {
            name: 'ServiceError',
            message: 'deposit not supported by this exchange',
            code: status.UNIMPLEMENTED,
            metadata: new Metadata(),
            details: 'deposit not supported by this exchange',
          },
          null,
        );
        return;
      }
      const params = structToParams(call.request.params?.value);
      const { code, amount, address, tag } = call.request;
      ex.deposit(code, amount, address, tag, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },

  withdraw(
    call: ServerUnaryCall<WithdrawRequest, GenericResponse>,
    cb: sendUnaryData<GenericResponse>,
  ) {
    try {
      const ex = ensureExchange(call);
      const params = structToParams(call.request.params?.value);
      const { code, amount, address, tag } = call.request;
      ex.withdraw(code, amount, address, tag, params)
        .then((data) => cb(null, { data: jsonToValue(asGrpcValue(data)) }))
        .catch((e: unknown) => cb(toServiceError(e), null));
    } catch (e: unknown) {
      cb(toServiceError(e), null);
    }
  },
};
