import { expect, test } from '@playwright/test';
import {
  MAX_GAME_FRAME_BYTES,
  MSG,
  decodeMessage,
  decodePositionUpdate,
  encodeMessage,
  encodeMovement,
} from '../packages/client-core/src';

test('protocol encoder rejects invalid message identifiers', () => {
  expect(() => encodeMessage(-1)).toThrow(RangeError);
  expect(() => encodeMessage(65_536)).toThrow(RangeError);
  expect(() => encodeMessage(1.5)).toThrow(RangeError);
});

test('protocol encoder and decoder enforce the public game-frame bound', () => {
  expect(() => encodeMessage(MSG.AUTH_REQUEST, new Uint8Array(MAX_GAME_FRAME_BYTES - 1))).toThrow(RangeError);
  expect(decodeMessage(new ArrayBuffer(MAX_GAME_FRAME_BYTES + 1))).toBeNull();
  expect(decodeMessage(new ArrayBuffer(1))).toBeNull();
});

test('movement encoder rejects NaN and Infinity before transport', () => {
  expect(() => encodeMovement(Number.NaN, 0)).toThrow(RangeError);
  expect(() => encodeMovement(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  expect(() => encodeMovement(Number.NEGATIVE_INFINITY, 0)).toThrow(RangeError);
});

test('position decoder rejects non-finite authoritative coordinates', () => {
  const frame = new ArrayBuffer(14);
  const view = new DataView(frame);
  view.setUint16(0, MSG.POSITION_UPDATE, false);
  view.setUint32(2, 42, false);
  view.setFloat32(6, Number.NaN, false);
  view.setFloat32(10, 1, false);
  expect(decodePositionUpdate(view)).toBeNull();

  view.setFloat32(6, 1, false);
  view.setFloat32(10, Number.POSITIVE_INFINITY, false);
  expect(decodePositionUpdate(view)).toBeNull();
});

test('position decoder rejects ambiguous truncated or trailing payloads', () => {
  expect(decodePositionUpdate(new DataView(new ArrayBuffer(13)))).toBeNull();
  expect(decodePositionUpdate(new DataView(new ArrayBuffer(15)))).toBeNull();
});

test('position decoder accepts a finite fixed-width frame', () => {
  const frame = new ArrayBuffer(14);
  const view = new DataView(frame);
  view.setUint16(0, MSG.POSITION_UPDATE, false);
  view.setUint32(2, 42, false);
  view.setFloat32(6, 1.25, false);
  view.setFloat32(10, -2.5, false);

  expect(decodePositionUpdate(view)).toEqual({ playerId: 42, x: 1.25, z: -2.5 });
});
