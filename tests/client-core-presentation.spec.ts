import { expect, test } from "@playwright/test";
import * as core from "../packages/client-core/src";

test("exports presentation classes and procedural factories", () => {
  expect(typeof core.PlayerPresentation).toBe("function");
  expect(typeof core.NPCPresentation).toBe("function");
  expect(typeof core.createProceduralCreaturePart).toBe("function");
  expect(typeof core.createProceduralTemplateProps).toBe("function");
  expect(typeof core.loadTemplateProps).toBe("function");
  expect(typeof core.buildFromBlueprint).toBe("function");
  expect(typeof core.buildCreature).toBe("function");
});
