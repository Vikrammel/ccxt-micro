import { status } from '@grpc/grpc-js';
import type { JsonValue, OhlcvEntry } from './types';

/**
 * Map JS -> google.protobuf.Value-compatible.
 * Note: protobuf Value cannot carry `undefined`, so we coerce it to `null`.
 */
export function asGrpcValue<T extends JsonValue>(data: T | undefined): T | null {
  return data === undefined ? null : data;
}

type ErrorLike = { name?: unknown; message?: unknown };

/** Convert a thrown value to gRPC status + message without using `any`. */
export function mapCcxtErrorToGrpc(err: unknown): { code: number; message: string } {
  const { name, message } =
    typeof err === 'object' && err !== null ? (err as ErrorLike) : ({} as ErrorLike);

  const nameStr = typeof name === 'string' ? name : '';
  const msgStr = typeof message === 'string' ? message : 'Unknown error';

  if (nameStr.includes('Authentication')) return { code: status.UNAUTHENTICATED, message: msgStr };
  if (nameStr.includes('Permission')) return { code: status.PERMISSION_DENIED, message: msgStr };
  if (nameStr.includes('Invalid')) return { code: status.INVALID_ARGUMENT, message: msgStr };
  if (nameStr.includes('NotSupported') || nameStr.includes('NotImplemented'))
    return { code: status.UNIMPLEMENTED, message: msgStr };
  if (nameStr.includes('OrderNotFound')) return { code: status.NOT_FOUND, message: msgStr };
  if (nameStr.includes('InsufficientFunds'))
    return { code: status.FAILED_PRECONDITION, message: msgStr };
  if (nameStr.includes('DDoS') || nameStr.includes('Network') || nameStr.includes('RequestTimeout'))
    return { code: status.UNAVAILABLE, message: msgStr };

  return { code: status.UNKNOWN, message: msgStr };
}

export function toOhlcv(entries: ReadonlyArray<ReadonlyArray<number>>): OhlcvEntry[] {
  return (entries ?? []).map((c) => ({
    timestamp: Math.trunc(c[0] ?? 0),
    open: Number(c[1] ?? 0),
    high: Number(c[2] ?? 0),
    low: Number(c[3] ?? 0),
    close: Number(c[4] ?? 0),
    volume: Number(c[5] ?? 0),
  }));
}
