import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  GameSiteGenerationError,
  renderGameSite,
} from "../packages/game-site-generator/src";
import type { GameManifest } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .reverse()
    .map(([key, child]) => [key, reverseObjectKeys(child)]));
}

test("production render returns the exact deterministic three-file contract", async () => {
  const generated = await renderGameSite(validGameManifest(), "production");
  expect(generated.files.map((file) => file.path)).toEqual([
    "index.html",
    "styles.css",
    "site-metadata.json",
  ]);
  for (const file of generated.files) expect(file.sha256).toBe(hash(file.bytes));

  const html = decode(generated.files[0]!.bytes);
  const css = decode(generated.files[1]!.bytes);
  const metadata = JSON.parse(decode(generated.files[2]!.bytes));
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("<title>Frontier Tutorial</title>");
  expect(html).toContain('class="skip-link"');
  for (const landmark of ["<header", "<nav", "<main", "<footer"]) expect(html).toContain(landmark);
  expect(html).toContain('href="./styles.css"');
  expect(html).not.toMatch(/<script|<iframe|<form|\son[a-z]+=/i);
  expect(html).not.toContain('data-site-mode="preview"');
  expect(html).not.toContain("noindex");
  for (const color of ["#101419", "#1c2530", "#f4ecd8", "#c4bca8", "#e1ad55"]) expect(css).toContain(color);
  expect(css).not.toMatch(/url\(|@import/i);
  expect(metadata).toEqual({
    schema: "uo.generated-game-site/v1",
    generator_version: "0.1.0",
    mode: "production",
    game_id: "game.tutorial-frontier",
    game_version: "0.1.0",
    manifest_sha256: generated.manifestSha256,
    files: [
      { path: "index.html", bytes: generated.files[0]!.bytes.length, sha256: generated.files[0]!.sha256 },
      { path: "styles.css", bytes: generated.files[1]!.bytes.length, sha256: generated.files[1]!.sha256 },
    ],
  });
});

test("preview output is visibly marked and forbidden from indexing", async () => {
  const manifest = validGameManifest();
  manifest.visibility = "private";
  manifest.publication.web = false;
  manifest.packages = { client_core: "unresolved", content_sdk: "unresolved", site_generator: "unresolved" };
  manifest.content_graph = "unresolved";
  const generated = await renderGameSite(manifest, "preview");
  const html = decode(generated.files[0]!.bytes);
  expect(html).toContain('data-site-mode="preview"');
  expect(html).toContain('content="noindex,nofollow"');
  expect(html).toContain("Preview — not published");
});

test("authored text is escaped and repeated generation is byte-identical", async () => {
  const manifest = validGameManifest();
  const payload = '<img src=x onerror="alert(1)">&\' </style>';
  manifest.name = payload;
  manifest.site.tagline = payload;
  manifest.site.synopsis = payload;
  manifest.site.features[0]!.title = payload;
  manifest.site.links = [{ kind: "documentation", label: payload, url: "https://example.invalid/docs" }];
  const first = await renderGameSite(manifest, "production");
  const second = await renderGameSite(reverseObjectKeys(manifest) as GameManifest, "production");
  expect(first).toEqual(second);
  const html = decode(first.files[0]!.bytes);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("</style>");
  expect(html).toContain("&lt;img");
  expect(html).toContain("&amp;");
  expect(html).toContain("https://example.invalid/docs");
});

test("rendering invalid production input returns one typed complete failure", async () => {
  const manifest = validGameManifest();
  manifest.visibility = "private";
  await expect(renderGameSite(manifest, "production")).rejects.toBeInstanceOf(GameSiteGenerationError);
  await expect(renderGameSite(manifest, "production")).rejects.toMatchObject({
    diagnostics: expect.arrayContaining([{ path: "/visibility", code: "production_requires_public" }]),
  });
  const error = await renderGameSite(manifest, "production").catch((caught) => caught as GameSiteGenerationError);
  expect(Object.isFrozen(error.diagnostics)).toBe(true);
});
