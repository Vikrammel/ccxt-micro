import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { serviceImpl } from './service';
import { mapCcxtErrorToGrpc } from './utils';

dotenv.config();

const PROTO_PATH = path.resolve(__dirname, '../proto/ccxt.proto');

const packageDef: protoLoader.PackageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Loaded packages are untyped; treat as a generic GrpcObject.
const loaded: grpc.GrpcObject = grpc.loadPackageDefinition(packageDef);

// Reach into our package and pull out the service definition, staying type-safe.
const ccxtmicro = loaded.ccxtmicro as grpc.GrpcObject;
const CcxtService = ccxtmicro.CcxtService as unknown as {
  service: grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
};

/**
 * Wrap an async unary handler so it satisfies `handleUnaryCall`'s `void` return
 * and avoids `@typescript-eslint/no-misused-promises`.
 */
function wrapUnary(
  fn: (
    call: grpc.ServerUnaryCall<unknown, unknown>,
    cb: grpc.sendUnaryData<unknown>,
  ) => Promise<void> | void,
): grpc.handleUnaryCall<unknown, unknown> {
  return (call, cb) => {
    try {
      const maybePromise = fn(call, cb);
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
        void (maybePromise as Promise<unknown>).catch((e) => {
          // Last-resort error path if handler threw before calling `cb`
          const { code, message } = mapCcxtErrorToGrpc(e);
          cb({ code, message } as never, null as never);
        });
      }
    } catch (e) {
      const { code, message } = mapCcxtErrorToGrpc(e);
      cb({ code, message } as never, null as never);
    }
  };
}

function main(): void {
  const server = new grpc.Server();

  // Provide an UntypedServiceImplementation with void-returning handlers.
  const handlers: grpc.UntypedServiceImplementation = {
    loadMarkets: wrapUnary(serviceImpl.loadMarkets as unknown as any),
    fetchMarkets: wrapUnary(serviceImpl.fetchMarkets as unknown as any),
    fetchCurrencies: wrapUnary(serviceImpl.fetchCurrencies as unknown as any),
    fetchTicker: wrapUnary(serviceImpl.fetchTicker as unknown as any),
    fetchTickers: wrapUnary(serviceImpl.fetchTickers as unknown as any),
    fetchOrderBook: wrapUnary(serviceImpl.fetchOrderBook as unknown as any),
    fetchOHLCV: wrapUnary(serviceImpl.fetchOHLCV as unknown as any),
    fetchStatus: wrapUnary(serviceImpl.fetchStatus as unknown as any),
    fetchTrades: wrapUnary(serviceImpl.fetchTrades as unknown as any),
    fetchBalance: wrapUnary(serviceImpl.fetchBalance as unknown as any),
    fetchOrder: wrapUnary(serviceImpl.fetchOrder as unknown as any),
    fetchOrders: wrapUnary(serviceImpl.fetchOrders as unknown as any),
    fetchOpenOrders: wrapUnary(serviceImpl.fetchOpenOrders as unknown as any),
    fetchClosedOrders: wrapUnary(serviceImpl.fetchClosedOrders as unknown as any),
    fetchMyTrades: wrapUnary(serviceImpl.fetchMyTrades as unknown as any),
    createOrder: wrapUnary(serviceImpl.createOrder as unknown as any),
    cancelOrder: wrapUnary(serviceImpl.cancelOrder as unknown as any),
    deposit: wrapUnary(serviceImpl.deposit as unknown as any),
    withdraw: wrapUnary(serviceImpl.withdraw as unknown as any),
  };

  server.addService(CcxtService.service, handlers);

  const port = process.env.PORT ? Number(process.env.PORT) : 50051;
  const addr = `0.0.0.0:${port}`;

  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) {
      console.error('Failed to bind:', err);
      process.exit(1);
    }
    console.log(`ccxt-micro gRPC server listening on ${addr}`);
    server.start();
  });
}

main();
