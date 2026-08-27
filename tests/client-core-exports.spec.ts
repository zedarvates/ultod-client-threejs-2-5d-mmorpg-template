import { expect, test } from "@playwright/test";
import * as core from "../packages/client-core/src";

test("exports client-core package version and metadata", () => {
  expect(typeof core).toBe("object");
  expect(core.CLIENT_CORE_VERSION).toBe("0.1.0");
});
