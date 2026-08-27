import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEntity } from "@ultod/content-sdk";
import type { ContentEntity } from "@ultod/content-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const entitiesDir = join(here, "../examples/tutorial-world/entities");

test("all 25 tutorial entity files exist and validate against uo.game-content-entity/v1", () => {
  const files = readdirSync(entitiesDir).filter((f) => f.endsWith(".json"));
  expect(files.length).toBe(25);

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(entitiesDir, file), "utf8")) as ContentEntity<unknown>;
    const validation = validateEntity(raw);
    expect(validation.valid, `File ${file} failed validation: ${JSON.stringify(validation.diagnostics)}`).toBe(true);
    expect(validation.diagnostics).toEqual([]);
  }
});
