import { test, expect } from "@playwright/test";
import {
  classifyBoundaryEntry,
  scanPublicBoundary,
} from "../scripts/check-public-boundary.mjs";

const privateLoreFixture = ["Princess", "Seris", "Vale"].join(" ");

test("public boundary classifies binary assets and private lore", () => {
  expect(classifyBoundaryEntry("public/creatures/part.glb", "")).toEqual([{
    code: "tracked-binary-asset",
    path: "public/creatures/part.glb",
    detail: "Public policy blocks .glb files",
  }]);

  expect(classifyBoundaryEntry("docs/lore/world.md", privateLoreFixture)[0]?.code)
    .toBe("private-lore-name");

  expect(classifyBoundaryEntry("assets/model.FBX", "")[0]?.code)
    .toBe("tracked-binary-asset");
  expect(classifyBoundaryEntry("docs/notes.md", "C:\\the-last-open-threshold")[0]?.code)
    .toBe("private-path");
  expect(classifyBoundaryEntry(
    "docs/superpowers/plans/containment.md",
    `${privateLoreFixture} at C:\\the-last-open-threshold`,
  )).toEqual([]);
  expect(classifyBoundaryEntry(
    "docs/superpowers/specs/architecture.md",
    "C:\\the-last-open-threshold",
  )[0]?.code).toBe("private-path");
});

test("public boundary rejects GLBs and private lore names", async () => {
  const findings = await scanPublicBoundary(process.cwd());
  expect(findings).toEqual([]);
});
