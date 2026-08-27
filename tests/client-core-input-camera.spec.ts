import { expect, test } from "@playwright/test";
import * as core from "../packages/client-core/src";

test("exports IsometricCamera and IsometricControls", () => {
  expect(typeof core.IsometricCamera).toBe("function");
  expect(typeof core.IsometricControls).toBe("function");
});

test("exports InputManager, KeyboardSource, PointerSource, and TouchJoystick", () => {
  expect(typeof core.InputManager).toBe("function");
  expect(typeof core.KeyboardSource).toBe("function");
  expect(typeof core.PointerSource).toBe("function");
  expect(typeof core.TouchJoystick).toBe("function");
});
