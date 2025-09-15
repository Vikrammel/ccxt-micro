import { status } from '@grpc/grpc-js';
import type { JsonValue, OhlcvEntry, Params } from './types';
import type {
  Value as ValueMsg,
  Struct as StructMsg,
  ListValue as ListValueMsg,
} from './generated/google/protobuf/struct';

/* ------------------------- small type guards (no any) ------------------------- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function isStructMsg(x: unknown): x is StructMsg {
  return isRecord(x) && 'fields' in x;
}
function isListValueMsg(x: unknown): x is ListValueMsg {
  return typeof x === 'object' && x !== null && 'values' in (x as Record<string, unknown>);
}

/* ---------------------- Value <-> plain JSON conversions ---------------------- */

// Plain JSON -> google.protobuf.Value (message shape)
export function jsonToValue(j: JsonValue | null | undefined): ValueMsg {
  if (j === null || j === undefined) return { nullValue: 0 } as ValueMsg;
  const t = typeof j;
  if (t === 'string') return { stringValue: j as string } as ValueMsg;
  if (t === 'number') return { numberValue: j as number } as ValueMsg;
  if (t === 'boolean') return { boolValue: j as boolean } as ValueMsg;

  if (Array.isArray(j)) {
    const values = (j as JsonValue[]).map((e) => jsonToValue(e));
    // listValue can be either Value[] or a ListValue message depending on codegen.
    // Use an `unknown` bridge to satisfy both variants without `any`.
    return { listValue: values as unknown as ValueMsg['listValue'] } as ValueMsg;
  }

  const fields: Record<string, ValueMsg> = {};
  for (const [k, v] of Object.entries(j as Record<string, JsonValue>)) {
    fields[k] = jsonToValue(v);
  }
  return { structValue: { fields } } as ValueMsg;
}

// google.protobuf.Value (message) -> plain JSON
function valueMsgToPlain(v: ValueMsg): JsonValue {
  if (v.nullValue !== undefined) return null;
  if (v.numberValue !== undefined) return v.numberValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue;

  if (v.structValue !== undefined) {
    return structMsgToPlain(v.structValue as StructMsg);
  }

  if (v.listValue !== undefined) {
    const lvUnknown = v.listValue as unknown;
    if (Array.isArray(lvUnknown)) {
      const arr = lvUnknown as ValueMsg[];
      return arr.map((x) => valueMsgToPlain(x));
    }
    if (isListValueMsg(lvUnknown)) {
      const arr = lvUnknown.values ?? [];
      return arr.map((x) => valueMsgToPlain(x as ValueMsg));
    }
    return [];
  }

  return null;
}

// Struct (message) -> plain Params (Record<string, JsonValue>)
function structMsgToPlain(s: StructMsg): Params {
  const out: Record<string, JsonValue> = {};
  const fields = (s.fields ?? {}) as Record<string, ValueMsg | undefined>;
  for (const [k, vv] of Object.entries(fields)) {
    if (vv !== undefined) out[k] = valueMsgToPlain(vv);
  }
  return out;
}

/* ---------- Converters used by your service ---------- */

// Accept Struct or plain object -> Params
export function structToParams(s?: StructMsg | Record<string, unknown> | null): Params | undefined {
  if (!s) return undefined;
  if (isStructMsg(s)) return structMsgToPlain(s);
  // Already a plain object; trust it matches Params (your ExchangeLike expects that)
  return s as Params;
}

// runtime check for tests/debugging
export function isProtoValue(v: unknown): v is ValueMsg {
  if (!isRecord(v)) return false;
  return (
    'nullValue' in v ||
    'numberValue' in v ||
    'stringValue' in v ||
    'boolValue' in v ||
    'structValue' in v ||
    'listValue' in v
  );
}

/** Map JS -> Value-compatible JSON (undefined becomes null for protobuf). */
export function asGrpcValue<T extends JsonValue | null | undefined>(data: T): JsonValue | null {
  return data === undefined ? null : data;
}

type ErrorLike = { name?: unknown; message?: unknown };

export function mapCcxtErrorToGrpc(err: unknown): { code: number; message: string } {
  const { name, message } = isRecord(err) ? (err as ErrorLike) : ({} as ErrorLike);
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
