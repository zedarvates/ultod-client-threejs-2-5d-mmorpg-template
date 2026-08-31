import { contrastRatio } from "./contrast.js";
import {
  CONSERVATIVE_SEMVER_RANGE_PATTERN,
  FEATURE_ID_PATTERN,
  GAME_ID_PATTERN,
  HEX_COLOR_PATTERN,
  LOCALE_PATTERN,
  MAX_MANIFEST_DIAGNOSTICS,
  SAFE_RELATIVE_JSON_PATH_PATTERN,
  SEMVER_PATTERN,
} from "./limits.js";
import type {
  GameManifest,
  GameManifestDiagnostic,
  GameManifestTheme,
  GameManifestValidationResult,
  SiteGenerationMode,
} from "./types.js";

type PlainRecord = Record<string, unknown>;

const ROOT_KEYS = new Set(["schema", "id", "name", "version", "visibility", "packages", "content_graph", "publication", "site"]);
const PACKAGE_KEYS = new Set(["client_core", "content_sdk", "site_generator"]);
const PUBLICATION_KEYS = new Set(["web", "steam"]);
const SITE_KEYS = new Set(["locale", "tagline", "synopsis", "world", "features", "credits", "legal", "links", "theme"]);
const WORLD_KEYS = new Set(["heading", "body"]);
const FEATURE_KEYS = new Set(["id", "title", "description"]);
const CREDIT_KEYS = new Set(["role", "name"]);
const LEGAL_KEYS = new Set(["copyright", "notice"]);
const LINK_KEYS = new Set(["kind", "label", "url"]);
const THEME_KEYS = new Set(["background", "surface", "text", "muted", "accent"]);
const LINK_KINDS = new Set(["community", "store", "support", "documentation"]);

function record(value: unknown): PlainRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as PlainRecord
    : undefined;
}

function scalarLength(value: string): number {
  return Array.from(value).length;
}

export function validateGameManifest(
  value: unknown,
  mode: SiteGenerationMode,
): GameManifestValidationResult {
  const diagnostics: GameManifestDiagnostic[] = [];
  const add = (path: string, code: string, detail?: string): void => {
    if (diagnostics.length >= MAX_MANIFEST_DIAGNOSTICS) return;
    diagnostics.push(detail === undefined ? { path, code } : { path, code, detail });
  };
  const requireOwn = (object: PlainRecord, key: string, path: string): boolean => {
    if (Object.prototype.hasOwnProperty.call(object, key)) return true;
    add(path, "missing_required_field");
    return false;
  };
  const rejectUnknown = (object: PlainRecord, allowed: Set<string>, path: string): void => {
    for (const key of Object.keys(object)) {
      if (!allowed.has(key)) add(`${path}/${key}`.replace("//", "/"), "unknown_key");
    }
  };
  const boundedString = (
    object: PlainRecord,
    key: string,
    path: string,
    minimum: number,
    maximum: number,
    code: string,
  ): string | undefined => {
    if (!requireOwn(object, key, path)) return undefined;
    const candidate = object[key];
    if (typeof candidate !== "string") {
      add(path, code);
      return undefined;
    }
    const length = scalarLength(candidate.trim());
    if (length < minimum || length > maximum) add(path, code);
    return candidate;
  };

  const root = record(value);
  if (!root) return { valid: false, diagnostics: [{ path: "/", code: "not_object" }] };
  rejectUnknown(root, ROOT_KEYS, "");

  if (requireOwn(root, "schema", "/schema") && root.schema !== "uo.game-manifest/v1") add("/schema", "invalid_schema");
  const id = boundedString(root, "id", "/id", 1, 69, "invalid_game_id");
  if (id !== undefined && !GAME_ID_PATTERN.test(id)) add("/id", "invalid_game_id");
  boundedString(root, "name", "/name", 1, 120, "invalid_name");
  const version = boundedString(root, "version", "/version", 1, 128, "invalid_version");
  if (version !== undefined && !SEMVER_PATTERN.test(version)) add("/version", "invalid_version");

  if (requireOwn(root, "visibility", "/visibility")) {
    if (root.visibility !== "public" && root.visibility !== "private" && root.visibility !== "local") add("/visibility", "invalid_visibility");
    if (mode === "production" && root.visibility !== "public") add("/visibility", "production_requires_public");
  }

  const packages = requireOwn(root, "packages", "/packages") ? record(root.packages) : undefined;
  if (!packages) {
    if (Object.prototype.hasOwnProperty.call(root, "packages")) add("/packages", "invalid_packages");
  } else {
    rejectUnknown(packages, PACKAGE_KEYS, "/packages");
    for (const key of PACKAGE_KEYS) {
      const path = `/packages/${key}`;
      if (!requireOwn(packages, key, path)) continue;
      const candidate = packages[key];
      if (candidate === "unresolved") {
        if (mode === "production") add(path, "unresolved_package");
      } else if (typeof candidate !== "string" || !CONSERVATIVE_SEMVER_RANGE_PATTERN.test(candidate)) {
        add(path, "invalid_package_range");
      }
    }
  }

  const contentGraph = boundedString(root, "content_graph", "/content_graph", 1, 512, "invalid_content_graph");
  if (contentGraph === "unresolved") {
    if (mode === "production") add("/content_graph", "unresolved_content_graph");
  } else if (contentGraph !== undefined && !SAFE_RELATIVE_JSON_PATH_PATTERN.test(contentGraph)) {
    add("/content_graph", "invalid_content_graph");
  }

  const publication = requireOwn(root, "publication", "/publication") ? record(root.publication) : undefined;
  if (!publication) {
    if (Object.prototype.hasOwnProperty.call(root, "publication")) add("/publication", "invalid_publication");
  } else {
    rejectUnknown(publication, PUBLICATION_KEYS, "/publication");
    for (const key of PUBLICATION_KEYS) {
      const path = `/publication/${key}`;
      if (requireOwn(publication, key, path) && typeof publication[key] !== "boolean") add(path, "invalid_boolean");
    }
    if (mode === "production" && publication.web !== true) add("/publication/web", "production_web_disabled");
  }

  const site = requireOwn(root, "site", "/site") ? record(root.site) : undefined;
  if (!site) {
    if (Object.prototype.hasOwnProperty.call(root, "site")) add("/site", "invalid_site");
  } else {
    rejectUnknown(site, SITE_KEYS, "/site");
    const locale = boundedString(site, "locale", "/site/locale", 1, 8, "invalid_locale");
    if (locale !== undefined && !LOCALE_PATTERN.test(locale)) add("/site/locale", "invalid_locale");
    boundedString(site, "tagline", "/site/tagline", 1, 180, "invalid_tagline");
    boundedString(site, "synopsis", "/site/synopsis", 1, 2000, "invalid_synopsis");

    const world = requireOwn(site, "world", "/site/world") ? record(site.world) : undefined;
    if (!world) {
      if (Object.prototype.hasOwnProperty.call(site, "world")) add("/site/world", "invalid_world");
    } else {
      rejectUnknown(world, WORLD_KEYS, "/site/world");
      boundedString(world, "heading", "/site/world/heading", 1, 100, "invalid_heading");
      boundedString(world, "body", "/site/world/body", 1, 2000, "invalid_body");
    }

    const features = requireOwn(site, "features", "/site/features") && Array.isArray(site.features) ? site.features : undefined;
    if (!features) {
      if (Object.prototype.hasOwnProperty.call(site, "features")) add("/site/features", "invalid_features");
    } else {
      if (features.length < 1 || features.length > 8) add("/site/features", "invalid_feature_count");
      const ids = new Set<string>();
      features.forEach((candidate, index) => {
        const feature = record(candidate);
        const base = `/site/features/${index}`;
        if (!feature) return add(base, "invalid_feature");
        rejectUnknown(feature, FEATURE_KEYS, base);
        const featureId = boundedString(feature, "id", `${base}/id`, 1, 64, "invalid_feature_id");
        if (featureId !== undefined) {
          if (!FEATURE_ID_PATTERN.test(featureId)) add(`${base}/id`, "invalid_feature_id");
          else if (ids.has(featureId)) add(`${base}/id`, "duplicate_feature_id");
          else ids.add(featureId);
        }
        boundedString(feature, "title", `${base}/title`, 1, 100, "invalid_title");
        boundedString(feature, "description", `${base}/description`, 1, 600, "invalid_description");
      });
    }

    const credits = requireOwn(site, "credits", "/site/credits") && Array.isArray(site.credits) ? site.credits : undefined;
    if (!credits) {
      if (Object.prototype.hasOwnProperty.call(site, "credits")) add("/site/credits", "invalid_credits");
    } else {
      if (credits.length < 1 || credits.length > 32) add("/site/credits", "invalid_credit_count");
      credits.forEach((candidate, index) => {
        const credit = record(candidate);
        const base = `/site/credits/${index}`;
        if (!credit) return add(base, "invalid_credit");
        rejectUnknown(credit, CREDIT_KEYS, base);
        boundedString(credit, "role", `${base}/role`, 1, 120, "invalid_role");
        boundedString(credit, "name", `${base}/name`, 1, 120, "invalid_name");
      });
    }

    const legal = requireOwn(site, "legal", "/site/legal") ? record(site.legal) : undefined;
    if (!legal) {
      if (Object.prototype.hasOwnProperty.call(site, "legal")) add("/site/legal", "invalid_legal");
    } else {
      rejectUnknown(legal, LEGAL_KEYS, "/site/legal");
      boundedString(legal, "copyright", "/site/legal/copyright", 1, 240, "invalid_copyright");
      boundedString(legal, "notice", "/site/legal/notice", 1, 1200, "invalid_notice");
    }

    const links = requireOwn(site, "links", "/site/links") && Array.isArray(site.links) ? site.links : undefined;
    if (!links) {
      if (Object.prototype.hasOwnProperty.call(site, "links")) add("/site/links", "invalid_links");
    } else {
      if (links.length > 8) add("/site/links", "invalid_link_count");
      links.forEach((candidate, index) => {
        const link = record(candidate);
        const base = `/site/links/${index}`;
        if (!link) return add(base, "invalid_link");
        rejectUnknown(link, LINK_KEYS, base);
        if (requireOwn(link, "kind", `${base}/kind`) && !LINK_KINDS.has(link.kind as string)) add(`${base}/kind`, "invalid_link_kind");
        boundedString(link, "label", `${base}/label`, 1, 80, "invalid_label");
        const url = boundedString(link, "url", `${base}/url`, 1, 2048, "invalid_https_url");
        if (url !== undefined) {
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.hostname === "") add(`${base}/url`, "invalid_https_url");
          } catch {
            add(`${base}/url`, "invalid_https_url");
          }
        }
      });
    }

    const theme = requireOwn(site, "theme", "/site/theme") ? record(site.theme) : undefined;
    if (!theme) {
      if (Object.prototype.hasOwnProperty.call(site, "theme")) add("/site/theme", "invalid_theme");
    } else {
      rejectUnknown(theme, THEME_KEYS, "/site/theme");
      const colors: Partial<GameManifestTheme> = {};
      const seenColors = new Map<string, string>();
      for (const key of THEME_KEYS) {
        const path = `/site/theme/${key}`;
        if (!requireOwn(theme, key, path)) continue;
        const color = theme[key];
        if (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color)) {
          add(path, "invalid_color");
          continue;
        }
        colors[key as keyof GameManifestTheme] = color;
        const normalizedColor = color.toLowerCase();
        const earlierKey = seenColors.get(normalizedColor);
        if (earlierKey !== undefined) add(path, "duplicate_theme_color", `matches ${earlierKey}`);
        else seenColors.set(normalizedColor, key);
      }
      if (Object.keys(colors).length === THEME_KEYS.size) {
        for (const foreground of ["text", "muted"] as const) {
          for (const background of ["background", "surface"] as const) {
            if (contrastRatio(colors[foreground]!, colors[background]!) < 4.5) add(`/site/theme/${foreground}`, "insufficient_contrast", `against ${background}`);
          }
        }
        for (const background of ["background", "surface"] as const) {
          if (contrastRatio(colors.accent!, colors[background]!) < 3) add("/site/theme/accent", "insufficient_contrast", `against ${background}`);
        }
      }
    }
  }

  diagnostics.sort((left, right) => left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || (left.detail ?? "").localeCompare(right.detail ?? ""));
  if (diagnostics.length > 0) return { valid: false, diagnostics };
  return { valid: true, diagnostics, manifest: structuredClone(value as GameManifest) };
}
