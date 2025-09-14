import { status } from '@grpc/grpc-js';

export function asGrpcValue(data: any): any {
  // With @grpc/proto-loader, plain JS maps cleanly to google.protobuf.Value
  // so we just return the data.
  return data === undefined ? null : data;
}

export function mapCcxtErrorToGrpc(err: any): { code: number; message: string } {
  const name = err?.name || '';
  const message = err?.message || 'Unknown error';

  // Generic mappings (subset of ccxt exceptions)
  if (name.includes('Authentication')) return { code: status.UNAUTHENTICATED, message };
  if (name.includes('Permission')) return { code: status.PERMISSION_DENIED, message };
  if (name.includes('Invalid')) return { code: status.INVALID_ARGUMENT, message };
  if (name.includes('NotSupported') || name.includes('NotImplemented'))
    return { code: status.UNIMPLEMENTED, message };
  if (name.includes('OrderNotFound')) return { code: status.NOT_FOUND, message };
  if (name.includes('InsufficientFunds')) return { code: status.FAILED_PRECONDITION, message };
  if (name.includes('DDoS') || name.includes('Network') || name.includes('RequestTimeout'))
    return { code: status.UNAVAILABLE, message };

  // Fallback
  return { code: status.UNKNOWN, message };
}

export function toOhlcv(entries: number[][]) {
  return (entries || []).map((c) => ({
    timestamp: Math.trunc(c[0] || 0),
    open: Number(c[1] || 0),
    high: Number(c[2] || 0),
    low: Number(c[3] || 0),
    close: Number(c[4] || 0),
    volume: Number(c[5] || 0),
  }));
}
