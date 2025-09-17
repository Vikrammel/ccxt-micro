import { describe, test, expect } from '@jest/globals';
import { status } from '@grpc/grpc-js';

import {
  jsonToValue,
  structToParams,
  isProtoValue,
  asGrpcValue,
  mapCcxtErrorToGrpc,
  toOhlcv,
} from '../src/utils';

import type { JsonValue, Params, OhlcvEntry } from '../src/types';

import type {
  Value as ValueMsg,
  Struct as StructMsg,
  ListValue as ListValueMsg,
} from '../src/generated/google/protobuf/struct';

/* -----------------------------------------------------------
   Helpers (typed, no `any`)
----------------------------------------------------------- */

function getListValues(listValue: ValueMsg['listValue'] | undefined): readonly ValueMsg[] {
  if (!listValue) return [];
  const lvUnknown: unknown = listValue;
  if (Array.isArray(lvUnknown)) {
    // Some codegen represents listValue as Value[]
    return lvUnknown as readonly ValueMsg[];
  }
  // Others represent it as a ListValue message
  const maybeList = lvUnknown as ListValueMsg;
  return maybeList.values ?? [];
}

function asStruct(fields: Record<string, ValueMsg | undefined>): StructMsg {
  return { fields };
}

/* -----------------------------------------------------------
   jsonToValue
----------------------------------------------------------- */

describe('jsonToValue', () => {
  test('maps primitives', () => {
    const vNull = jsonToValue(null);
    const vUndef = jsonToValue(undefined);
    const vStr = jsonToValue('abc');
    const vNum = jsonToValue(42);
    const vBool = jsonToValue(true);

    expect(vNull.nullValue).toBe(0);
    expect(vUndef.nullValue).toBe(0);
    expect(vStr.stringValue).toBe('abc');
    expect(vNum.numberValue).toBe(42);
    expect(vBool.boolValue).toBe(true);
  });

  test('maps arrays to listValue (both representations supported)', () => {
    const v = jsonToValue(['x', 1, false]);
    const items = getListValues(v.listValue);

    expect(items).toHaveLength(3);
    expect(items[0].stringValue).toBe('x');
    expect(items[1].numberValue).toBe(1);
    expect(items[2].boolValue).toBe(false);
  });

  test('maps objects to structValue.fields', () => {
    const v = jsonToValue({ a: 1, b: 'y', c: true });
    const struct = v.structValue as StructMsg;
    expect(struct).toBeDefined();
    const { fields } = struct;
    expect(fields?.a?.numberValue).toBe(1);
    expect(fields?.b?.stringValue).toBe('y');
    expect(fields?.c?.boolValue).toBe(true);
  });
});

/* -----------------------------------------------------------
   structToParams
----------------------------------------------------------- */

describe('structToParams', () => {
  test('returns undefined for nullish', () => {
    expect(structToParams(null)).toBeUndefined();
    expect(structToParams(undefined)).toBeUndefined();
  });

  test('converts StructMsg to Params', () => {
    const s = asStruct({
      n: { numberValue: 7 } as ValueMsg,
      s: { stringValue: 'ok' } as ValueMsg,
      b: { boolValue: false } as ValueMsg,
      z: { nullValue: 0 } as ValueMsg,
      obj: { structValue: asStruct({ k: { stringValue: 'v' } as ValueMsg }) } as ValueMsg,
      arr: {
        listValue: [{ numberValue: 1 } as ValueMsg, { numberValue: 2 } as ValueMsg],
      } as ValueMsg,
    });

    const params = structToParams(s) as Params;
    expect(params.n).toBe(7);
    expect(params.s).toBe('ok');
    expect(params.b).toBe(false);
    expect(params.z).toBeNull();
    expect(params.obj && typeof params.obj === 'object' && !Array.isArray(params.obj)).toBe(true);
    expect((params.obj as Record<string, JsonValue>).k).toBe('v');
    expect(Array.isArray(params.arr)).toBe(true);
    expect((params.arr as readonly JsonValue[])[0]).toBe(1);
    expect((params.arr as readonly JsonValue[])[1]).toBe(2);
  });

  test('passes through plain objects as Params', () => {
    const plain: Record<string, JsonValue> = { a: 1, b: 'two', c: null };
    const params = structToParams(plain);
    expect(params).toEqual(plain);
  });
});

/* -----------------------------------------------------------
   isProtoValue
----------------------------------------------------------- */

describe('isProtoValue', () => {
  test('accepts objects with any ValueMsg discriminator', () => {
    expect(isProtoValue({ nullValue: 0 })).toBe(true);
    expect(isProtoValue({ numberValue: 1 })).toBe(true);
    expect(isProtoValue({ stringValue: 'x' })).toBe(true);
    expect(isProtoValue({ boolValue: false })).toBe(true);
    expect(isProtoValue({ structValue: asStruct({}) })).toBe(true);
    expect(isProtoValue({ listValue: [] as ValueMsg[] })).toBe(true);
  });

  test('rejects non-Value-like objects', () => {
    expect(isProtoValue({})).toBe(false);
    expect(isProtoValue(123)).toBe(false);
    expect(isProtoValue('str')).toBe(false);
    expect(isProtoValue(null)).toBe(false);
    expect(isProtoValue(undefined)).toBe(false);
  });
});

/* -----------------------------------------------------------
   asGrpcValue
----------------------------------------------------------- */

describe('asGrpcValue', () => {
  test('turns undefined into null, leaves others unchanged', () => {
    expect(asGrpcValue(undefined)).toBeNull();
    expect(asGrpcValue(null)).toBeNull();
    expect(asGrpcValue(0)).toBe(0);
    expect(asGrpcValue('x')).toBe('x');
    expect(asGrpcValue(false)).toBe(false);
    expect(asGrpcValue(['a'] as const)).toEqual(['a']);
    expect(asGrpcValue({ k: 'v' } as const)).toEqual({ k: 'v' });
  });
});

/* -----------------------------------------------------------
   mapCcxtErrorToGrpc
----------------------------------------------------------- */

describe('mapCcxtErrorToGrpc', () => {
  type ErrShape = { name?: string; message?: string };

  const map = (name: string, message = 'msg'): { code: number; message: string } =>
    mapCcxtErrorToGrpc({ name, message } as ErrShape);

  test('known name patterns map to specific gRPC codes', () => {
    expect(map('AuthenticationError')).toEqual({ code: status.UNAUTHENTICATED, message: 'msg' });
    expect(map('PermissionDenied')).toEqual({ code: status.PERMISSION_DENIED, message: 'msg' });
    expect(map('InvalidOrder')).toEqual({ code: status.INVALID_ARGUMENT, message: 'msg' });
    expect(map('NotSupported')).toEqual({ code: status.UNIMPLEMENTED, message: 'msg' });
    expect(map('NotImplemented')).toEqual({ code: status.UNIMPLEMENTED, message: 'msg' });
    expect(map('OrderNotFound')).toEqual({ code: status.NOT_FOUND, message: 'msg' });
    expect(map('InsufficientFunds')).toEqual({ code: status.FAILED_PRECONDITION, message: 'msg' });
    expect(map('DDoSProtection')).toEqual({ code: status.UNAVAILABLE, message: 'msg' });
    expect(map('NetworkError')).toEqual({ code: status.UNAVAILABLE, message: 'msg' });
    expect(map('RequestTimeout')).toEqual({ code: status.UNAVAILABLE, message: 'msg' });
  });

  test('falls back to UNKNOWN with safe message', () => {
    expect(map('SomeOtherError', 'boom')).toEqual({ code: status.UNKNOWN, message: 'boom' });
    // Missing/invalid message becomes "Unknown error"
    const res = mapCcxtErrorToGrpc({ name: 'SomeOtherError' } as { name: string });
    expect(res).toEqual({ code: status.UNKNOWN, message: 'Unknown error' });
  });

  test('handles non-object input defensively', () => {
    const res = mapCcxtErrorToGrpc('oops');
    expect(res.code).toBe(status.UNKNOWN);
    expect(res.message).toBe('Unknown error');
  });
});

/* -----------------------------------------------------------
   toOhlcv
----------------------------------------------------------- */

describe('toOhlcv', () => {
  test('maps full tuples correctly', () => {
    const ts = 1_700_000_000_000;
    const out: OhlcvEntry[] = toOhlcv([[ts, 1, 2, 3, 4, 5]]);
    expect(out).toEqual([
      {
        timestamp: ts,
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        volume: 5,
      },
    ]);
  });

  test('defaults missing fields to zero with truncation for timestamp', () => {
    // Provide a shorter row to ensure defaulting code paths are exercised.
    const out = toOhlcv([[1690000000000]] as ReadonlyArray<ReadonlyArray<number>>);
    expect(out[0].timestamp).toBe(1690000000000);
    expect(out[0].open).toBe(0);
    expect(out[0].high).toBe(0);
    expect(out[0].low).toBe(0);
    expect(out[0].close).toBe(0);
    expect(out[0].volume).toBe(0);
  });

  test('handles empty input', () => {
    expect(toOhlcv([])).toEqual([]);
  });
});
