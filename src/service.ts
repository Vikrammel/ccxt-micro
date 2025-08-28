import { sendUnaryData, ServerUnaryCall, status } from '@grpc/grpc-js';
import { createExchange } from './exchangeFactory';
import { asGrpcValue, mapCcxtErrorToGrpc, toOhlcv } from './utils';
import { ExchangeLike } from './types';

// Type aliases for request shapes that match proto-loader outputs
type AnyReq = { request: any };

export class CcxtServiceImpl {
  private getExchange(call: AnyReq): ExchangeLike {
    const { config, credentials } = call.request;
    if (!config?.exchange) {
      throw { name: 'InvalidArguments', message: 'config.exchange is required' };
    }
    return createExchange(config, credentials);
  }

  private ok<T>(callback: sendUnaryData<T>, payload: T) {
    callback(null, payload);
  }

  private fail<T>(callback: sendUnaryData<T>, err: any) {
    const mapped = mapCcxtErrorToGrpc(err);
    callback({ code: mapped.code, message: mapped.message } as any, null as any);
  }

  loadMarkets = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const ex = this.getExchange(call as AnyReq);
      const { reload, params } = call.request;
      const data = await ex.loadMarkets(reload, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchMarkets = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchMarkets(call.request?.params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchCurrencies = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchCurrencies(call.request?.params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchTicker = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchTicker(symbol, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchTickers = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbols, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchTickers(symbols?.length ? symbols : undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchOrderBook = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchOrderBook(symbol, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchOHLCV = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, timeframe, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchOHLCV(symbol, timeframe || undefined, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { candles: toOhlcv(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchStatus = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const ex = this.getExchange(call as AnyReq);
      if (!ex.fetchStatus) {
        return callback({ code: status.UNIMPLEMENTED, message: 'fetchStatus not supported by this exchange' } as any, null as any);
      }
      const data = await ex.fetchStatus(call.request?.params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchTrades = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchTrades(symbol, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchBalance = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchBalance(call.request?.params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchOrder = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { id, symbol, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchOrder(id, symbol || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchOrders = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchOrders(symbol || undefined, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchOpenOrders = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchOpenOrders(symbol || undefined, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchClosedOrders = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchClosedOrders(symbol || undefined, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  fetchMyTrades = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, since, limit, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.fetchMyTrades(symbol || undefined, since || undefined, limit || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  createOrder = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { symbol, type, side, amount, price, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.createOrder(symbol, type, side, amount, price || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  cancelOrder = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { id, symbol, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.cancelOrder(id, symbol || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  deposit = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { code, amount, address, tag, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      if (!ex.deposit) {
        return callback({ code: status.UNIMPLEMENTED, message: 'deposit not supported by this exchange' } as any, null as any);
      }
      const data = await ex.deposit(code, amount, address, tag || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };

  withdraw = async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
    try {
      const { code, amount, address, tag, params } = call.request;
      const ex = this.getExchange(call as AnyReq);
      const data = await ex.withdraw(code, amount, address, tag || undefined, params?.value);
      this.ok(callback, { data: asGrpcValue(data) });
    } catch (err) {
      this.fail(callback, err);
    }
  };
}

export const serviceImpl = new CcxtServiceImpl();
