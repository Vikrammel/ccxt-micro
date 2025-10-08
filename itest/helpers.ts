import * as grpc from '@grpc/grpc-js';
import { Value as ValueMsg, Struct as StructMsg } from '../src/generated/google/protobuf/struct';

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitUntilReady(
  check: () => Promise<boolean>,
  { timeoutMs = 20000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return;
    } catch {
      // ignore and retry
    }
    await wait(intervalMs);
  }
  throw new Error(`Service not ready within ${timeoutMs}ms`);
}

export function creds(): grpc.ChannelCredentials {
  return grpc.credentials.createInsecure();
}

/* ---------------- google.protobuf.Value helpers ---------------- */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

// Some ts-proto versions model listValue as { values: Value[] }, others as Value[]
function hasValuesField(x: unknown): x is { values: ValueMsg[] } {
  return isObject(x) && 'values' in x && Array.isArray((x as { values?: unknown }).values);
}

export function valueMsgToPlain(v: ValueMsg): unknown {
  if (v.nullValue !== undefined) return null;
  if (v.numberValue !== undefined) return v.numberValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue;

  if (v.structValue !== undefined) {
    const out: Record<string, unknown> = {};
    const fields = v.structValue.fields ?? {};
    for (const [k, vv] of Object.entries(fields)) {
      if (vv) out[k] = valueMsgToPlain(vv as ValueMsg);
    }
    return out;
  }

  if (v.listValue !== undefined) {
    const lvUnknown: unknown = v.listValue as unknown;
    const arr: ValueMsg[] = Array.isArray(lvUnknown)
      ? (lvUnknown as ValueMsg[])
      : hasValuesField(lvUnknown)
        ? lvUnknown.values
        : [];
    return arr.map((x: ValueMsg) => valueMsgToPlain(x));
  }

  return null;
}

export function valueTo<T>(v?: ValueMsg): T {
  // default to null Value if undefined
  return valueMsgToPlain(v ?? ({ nullValue: 0 } as ValueMsg)) as T;
}

export function structEmpty(): { value: ReturnType<typeof StructMsg.fromJSON> } {
  return { value: StructMsg.fromJSON({}) };
}
