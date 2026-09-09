export const MAX_MANIFEST_DEPTH = 8;
export const MAX_MANIFEST_NODES = 512;
export const MAX_MANIFEST_OWN_KEYS = 32;
export const MAX_MANIFEST_ARRAY_ITEMS = 32;
export const MAX_MANIFEST_STRING_LENGTH = 2000;
export const MAX_MANIFEST_DIAGNOSTICS = 256;

export const GAME_ID_PATTERN = /^game\.[a-z][a-z0-9-]{2,63}$/;
export const FEATURE_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
export const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const SEMVER_CORE = "(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)";
const SEMVER_PRERELEASE_IDENTIFIER = "(?:0|[1-9]\\d*|[A-Za-z-][0-9A-Za-z-]*)";
const SEMVER_PRERELEASE = `(?:-${SEMVER_PRERELEASE_IDENTIFIER}(?:\\.${SEMVER_PRERELEASE_IDENTIFIER})*)?`;
const SEMVER_BUILD = "(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?";
export const SEMVER_PATTERN = new RegExp(`^${SEMVER_CORE}${SEMVER_PRERELEASE}${SEMVER_BUILD}$`);
export const CONSERVATIVE_SEMVER_RANGE_PATTERN = new RegExp(
  `^(?:\\^|~|>=|<=)?${SEMVER_CORE}${SEMVER_PRERELEASE}${SEMVER_BUILD}$`,
);

export const SAFE_RELATIVE_JSON_PATH_PATTERN = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._-]+)*\.json$/;
