export { GAME_SITE_GENERATOR_VERSION } from "./version.js";

export { contrastRatio, relativeLuminance } from "./contrast.js";
export { createNodeSiteFileSystem } from "./fs-adapter.js";
export { sha256CanonicalGameManifest } from "./hash.js";
export {
  GameManifestCanonicalizationError,
  normalizeGameManifest,
  serializeCanonicalGameManifest,
} from "./normalize.js";
export { GameSiteGenerationError, renderGameSite } from "./render.js";
export {
  UnsafeSiteOutputPathError,
  assertSafeSiteOutputPath,
} from "./path-policy.js";
export { SiteTransactionError, writeGeneratedSite } from "./transaction.js";
export type { SiteTransactionCategory } from "./transaction.js";
export { validateGameManifest } from "./validate.js";
export type { SiteFileSystem, SitePathState } from "./fs-adapter.js";
export type { SafeSitePaths, SiteOutputPathOptions } from "./path-policy.js";

export {
  CONSERVATIVE_SEMVER_RANGE_PATTERN,
  FEATURE_ID_PATTERN,
  GAME_ID_PATTERN,
  HEX_COLOR_PATTERN,
  LOCALE_PATTERN,
  MAX_MANIFEST_ARRAY_ITEMS,
  MAX_MANIFEST_DEPTH,
  MAX_MANIFEST_DIAGNOSTICS,
  MAX_MANIFEST_NODES,
  MAX_MANIFEST_OWN_KEYS,
  MAX_MANIFEST_STRING_LENGTH,
  SAFE_RELATIVE_JSON_PATH_PATTERN,
  SEMVER_PATTERN,
} from "./limits.js";

export type {
  GameManifest,
  GameManifestCredit,
  GameManifestDiagnostic,
  GameManifestFeature,
  GameManifestLink,
  GameManifestPackages,
  GameManifestSite,
  GameManifestTheme,
  GameManifestValidationResult,
  GameSiteLinkKind,
  GameVisibility,
  GeneratedGameSite,
  GeneratedSiteFile,
  GeneratedSitePath,
  SiteGenerationMode,
} from "./types.js";
