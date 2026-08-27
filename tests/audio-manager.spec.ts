// SPDX-License-Identifier: MIT
// Unit tests for fail-closed AudioManager.

import { test, expect } from "@playwright/test";
import { AudioManager } from "../src/audio/audio-manager";

test("AudioManager instantiates and fails closed without throwing when offline", async () => {
  const audio = new AudioManager();
  expect(audio).toBeDefined();

  // Playing without unlock should not throw
  await expect(audio.play("ui_click")).resolves.toBeUndefined();

  // Setting volume should not throw
  audio.setMasterVolume(0.5);
});
