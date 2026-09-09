import { expect, test } from '@playwright/test';
import * as appProtocol from '../src/net/protocol';
import { NetworkClient as AppNetworkClient } from '../src/net/network-client';
import * as coreProtocol from '../packages/client-core/src/net/protocol';
import { NetworkClient as CoreNetworkClient } from '../packages/client-core/src/net/network-client';

test('application and client-core share one protocol implementation', () => {
  expect(appProtocol.MSG).toBe(coreProtocol.MSG);
  expect(appProtocol.encodeMessage).toBe(coreProtocol.encodeMessage);
  expect(appProtocol.decodeMessage).toBe(coreProtocol.decodeMessage);
  expect(appProtocol.encodeMovement).toBe(coreProtocol.encodeMovement);
  expect(appProtocol.decodePositionUpdate).toBe(coreProtocol.decodePositionUpdate);
});

test('application and client-core share one NetworkClient implementation', () => {
  expect(AppNetworkClient).toBe(CoreNetworkClient);
});
