import * as grpc from '@grpc/grpc-js';
import dotenv from 'dotenv';
import { CcxtServiceService } from './generated/ccxt';
import { serviceImpl } from './service';

dotenv.config();

function main(): void {
  const server = new grpc.Server();
  server.addService(CcxtServiceService, serviceImpl);

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
