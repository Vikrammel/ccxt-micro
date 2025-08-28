import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { serviceImpl } from './service';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PROTO_PATH = path.resolve(__dirname, '../proto/ccxt.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef) as any;

function main() {
  const server = new grpc.Server();
  server.addService(proto.ccxtmicro.CcxtService.service, {
    loadMarkets: serviceImpl.loadMarkets,
    fetchMarkets: serviceImpl.fetchMarkets,
    fetchCurrencies: serviceImpl.fetchCurrencies,
    fetchTicker: serviceImpl.fetchTicker,
    fetchTickers: serviceImpl.fetchTickers,
    fetchOrderBook: serviceImpl.fetchOrderBook,
    fetchOHLCV: serviceImpl.fetchOHLCV,
    fetchStatus: serviceImpl.fetchStatus,
    fetchTrades: serviceImpl.fetchTrades,
    fetchBalance: serviceImpl.fetchBalance,
    fetchOrder: serviceImpl.fetchOrder,
    fetchOrders: serviceImpl.fetchOrders,
    fetchOpenOrders: serviceImpl.fetchOpenOrders,
    fetchClosedOrders: serviceImpl.fetchClosedOrders,
    fetchMyTrades: serviceImpl.fetchMyTrades,
    createOrder: serviceImpl.createOrder,
    cancelOrder: serviceImpl.cancelOrder,
    deposit: serviceImpl.deposit,
    withdraw: serviceImpl.withdraw,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 50051;
  const addr = `0.0.0.0:${port}`;

  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error('Failed to bind:', err);
      process.exit(1);
    }
    console.log(`ccxt-micro gRPC server listening on ${addr}`);
    server.start();
  });
}

main();
