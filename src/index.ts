import * as grpc from '@grpc/grpc-js';
import dotenv from 'dotenv';
import { CcxtServiceService } from './generated/ccxt';
import { serviceImpl } from './service';

dotenv.config();

function main(): void {
  const server = new grpc.Server();
  server.addService(CcxtServiceService, serviceImpl);

  const port = Number(process.env.PORT ?? 50051);
  const addr = `0.0.0.0:${port}`;

  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error('Failed to bind:', err);
      process.exit(1);
    }
    // No server.start(): it’s deprecated & unnecessary in @grpc/grpc-js >= 1.10.x

    console.log(`ccxt-micro gRPC server listening on 0.0.0.0:${boundPort}`);
  });

  // Graceful shutdown
  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`\nReceived ${signal}, shutting down gRPC server...`);
    server.tryShutdown((shutdownErr) => {
      if (shutdownErr) {
        console.error('Error during gRPC shutdown, forcing:', shutdownErr);
        server.forceShutdown();
      }
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
