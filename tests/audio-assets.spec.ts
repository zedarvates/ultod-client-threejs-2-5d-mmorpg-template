// SPDX-License-Identifier: MIT

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packRoot = join(here, "../public/audio/basic-audio");

test("generated audio pack is approved for public MIT distribution without imported artifacts", () => {
  const license = JSON.parse(readFileSync(join(packRoot, "license.json"), "utf8"));
  const catalog = JSON.parse(readFileSync(join(packRoot, "audio-catalog.json"), "utf8"));

  expect(license).toMatchObject({
    id: "MIT",
    status: "approved_for_public_template",
    provenance: "generated_in_repository",
    terms: { production_release: "approved" },
  });
  expect(license.terms.allowed_usage).toEqual([
    "development",
    "testing",
    "public_distribution",
    "commercial_use",
    "modification",
  ]);
  expect(license.references.every((reference: { imported_artifacts?: number }) =>
    reference.imported_artifacts === 0,
  )).toBe(true);
  expect(catalog.license.id).toBe("MIT");
  expect(catalog.items.every((item: { provenance?: { mode?: string } }) =>
    item.provenance?.mode === "generated_in_repository",
  )).toBe(true);
});

test("generated audio catalog contains the scenario SFX with audited PCM metadata", () => {
  const catalog = JSON.parse(readFileSync(join(packRoot, "audio-catalog.json"), "utf8"));
  const items = new Map(catalog.items.map((item: { id: string }) => [item.id, item]));
  const required = [
    "sfx.ui_click",
    "sfx.ui_dialog_open",
    "sfx.sword_swing",
    "sfx.impact_hit",
    "sfx.coins",
    "sfx.beast_roar",
    "sfx.victory_fanfare",
  ];

  expect(catalog.status).toBe("ready");
  expect(catalog.compatibility).toMatchObject({
    container: "wav",
    codec: "pcm_s16le",
    sample_rate_hz: 48_000,
    sample_width_bits: 16,
  });
  for (const id of required) {
    const item = items.get(id) as { sha256?: string; bytes?: number; duration_ms?: number } | undefined;
    expect(item, id).toBeDefined();
    expect(item?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(item?.bytes).toBeGreaterThan(44);
    expect(item?.duration_ms).toBeGreaterThan(0);
  }
});

test("the dev server serves a real WAV for an integrated gameplay event", async ({ page }) => {
  await page.goto("/");
  const proof = await page.evaluate(async () => {
    const response = await fetch("audio/basic-audio/SFX/sword_swing.wav");
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      ok: response.ok,
      riff: String.fromCharCode(...bytes.slice(0, 4)),
      wave: String.fromCharCode(...bytes.slice(8, 12)),
      byteLength: bytes.byteLength,
    };
  });

  expect(proof).toMatchObject({ ok: true, riff: "RIFF", wave: "WAVE" });
  expect(proof.byteLength).toBeGreaterThan(44);
});
