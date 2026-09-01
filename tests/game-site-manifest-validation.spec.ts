import { expect, test } from "@playwright/test";
import {
  contrastRatio,
  validateGameManifest,
} from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

test("preview accepts unresolved private metadata while production fails closed", () => {
  const preview = validGameManifest();
  preview.visibility = "private";
  preview.packages = {
    client_core: "unresolved",
    content_sdk: "unresolved",
    site_generator: "unresolved",
  };
  preview.content_graph = "unresolved";
  preview.publication.web = false;

  expect(validateGameManifest(preview, "preview").diagnostics).toEqual([]);
  expect(validateGameManifest(preview, "production").diagnostics).toEqual(expect.arrayContaining([
    { path: "/visibility", code: "production_requires_public" },
    { path: "/publication/web", code: "production_web_disabled" },
    { path: "/packages/client_core", code: "unresolved_package" },
    { path: "/content_graph", code: "unresolved_content_graph" },
  ]));
});

test("validation rejects unknown keys, unsafe values, duplicates and collection overflow", () => {
  const invalid = validGameManifest() as unknown as Record<string, unknown>;
  invalid.extra = true;
  const site = invalid.site as Record<string, unknown>;
  site.extra = true;
  site.locale = "EN_us";
  site.features = [
    { id: "same-feature", title: "One", description: "First" },
    { id: "same-feature", title: "Two", description: "Second" },
  ];
  site.links = [{ kind: "store", label: "Unsafe", url: "http://user:pass@example.invalid" }];
  invalid.content_graph = "../private.json";

  expect(validateGameManifest(invalid, "preview").diagnostics).toEqual(expect.arrayContaining([
    { path: "/extra", code: "unknown_key" },
    { path: "/site/extra", code: "unknown_key" },
    { path: "/site/locale", code: "invalid_locale" },
    { path: "/site/features/1/id", code: "duplicate_feature_id" },
    { path: "/site/links/0/url", code: "invalid_https_url" },
    { path: "/content_graph", code: "invalid_content_graph" },
  ]));

  const tooMany = validGameManifest();
  tooMany.site.features = Array.from({ length: 9 }, (_, index) => ({
    id: `feature-${index}`,
    title: `Feature ${index}`,
    description: "Bounded feature.",
  }));
  expect(validateGameManifest(tooMany, "preview").diagnostics).toContainEqual({
    path: "/site/features",
    code: "invalid_feature_count",
  });
});

test("validation requires own fields and returns a detached manifest", () => {
  const authored = validGameManifest();
  const result = validateGameManifest(authored, "production");
  expect(result).toMatchObject({ valid: true, diagnostics: [] });
  expect(result.manifest).toEqual(authored);
  expect(result.manifest).not.toBe(authored);
  expect(result.manifest?.site).not.toBe(authored.site);

  const inherited = Object.create({ schema: "uo.game-manifest/v1" }) as Record<string, unknown>;
  Object.assign(inherited, authored);
  delete inherited.schema;
  expect(validateGameManifest(inherited, "preview").diagnostics).toContainEqual({
    path: "/schema",
    code: "missing_required_field",
  });
});

test("contrast uses WCAG ratios and blocks an inaccessible text theme", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
  expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.4781, 4);

  const manifest = validGameManifest();
  manifest.site.theme.text = "#777777";
  manifest.site.theme.background = "#ffffff";
  expect(validateGameManifest(manifest, "preview").diagnostics).toContainEqual({
    path: "/site/theme/text",
    code: "insufficient_contrast",
    detail: "against background",
  });

  manifest.site.theme.text = "#fff";
  expect(validateGameManifest(manifest, "preview").diagnostics).toContainEqual({
    path: "/site/theme/text",
    code: "invalid_color",
  });

  const duplicate = validGameManifest();
  duplicate.site.theme.accent = duplicate.site.theme.background;
  expect(validateGameManifest(duplicate, "preview").diagnostics).toContainEqual({
    path: "/site/theme/accent",
    code: "duplicate_theme_color",
    detail: "matches background",
  });
});
