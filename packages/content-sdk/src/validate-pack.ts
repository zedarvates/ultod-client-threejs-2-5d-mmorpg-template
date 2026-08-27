import {
  CONTENT_ARTIFACT_ROLES,
  CONTENT_PROVENANCE_KINDS,
} from "./pack-types.js";
import {
  CONTENT_ID_PATTERN,
  MAX_COMPATIBILITY_STRING_LENGTH,
  MAX_SERVER_PROTOCOL_LENGTH,
  MAX_SERVER_PROTOCOLS,
  SEMVER_PATTERN,
} from "./validate-entity.js";
import type { ValidationDiagnostic, ValidationResult } from "./types.js";

export const MAX_PACK_OWN_KEYS = 64;
export const MAX_PACK_ARTIFACTS = 16_384;
export const MAX_ARTIFACT_OWN_KEYS = 16;
export const MAX_PACK_NESTED_OWN_KEYS = 16;
export const MAX_ARTIFACT_PATH_LENGTH = 1_024;
export const MAX_MEDIA_TYPE_LENGTH = 128;
export const MAX_LICENSE_ID_LENGTH = 128;
export const MAX_PROVENANCE_SOURCE_LENGTH = 256;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const PORTABLE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const LICENSE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
const PACK_KEYS = new Set([
  "schema",
  "id",
  "version",
  "status",
  "visibility",
  "compatibility",
  "artifacts",
]);
const COMPATIBILITY_KEYS = new Set(["content_graph", "client_core", "server_protocol"]);
const ARTIFACT_KEYS = new Set([
  "role",
  "content_id",
  "path",
  "sha256",
  "media_type",
  "license",
  "provenance",
]);
const LICENSE_KEYS = new Set(["id"]);
const PROVENANCE_KEYS = new Set(["kind", "source"]);
const PACK_STATUSES = new Set(["draft", "published", "deprecated"]);
const PACK_VISIBILITIES = new Set(["public", "private", "local"]);

type UnknownRecord = Record<string, unknown>;
type UntrustedAccess<T> = { accessible: true; value: T } | { accessible: false };

function accessUntrusted<T>(accessor: () => T): UntrustedAccess<T> {
  try {
    return { accessible: true, value: accessor() };
  } catch {
    return { accessible: false };
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      compareOrdinal(left.code, right.code) ||
      compareOrdinal(left.path, right.path) ||
      compareOrdinal(left.message, right.message),
  );
}

function addDiagnostic(
  diagnostics: ValidationDiagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function invalidPackAccess(): ValidationResult {
  return {
    valid: false,
    diagnostics: [
      {
        code: "invalid_pack_access",
        path: "$",
        message: "Pack properties could not be read",
      },
    ],
  };
}

function keyPath(base: string, key: PropertyKey): string {
  if (typeof key === "symbol") return `${base}[${String(key)}]`;
  const text = String(key);
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)
    ? `${base}.${text}`
    : `${base}[${JSON.stringify(text)}]`;
}

function validateKnownKeys(
  record: object,
  allowed: ReadonlySet<string>,
  maximum: number,
  basePath: string,
  unknownCode: string,
  limitCode: string,
  diagnostics: ValidationDiagnostic[],
): UntrustedAccess<boolean> {
  const keysAccess = accessUntrusted(() => Reflect.ownKeys(record));
  if (!keysAccess.accessible) return { accessible: false };
  if (keysAccess.value.length > maximum) {
    addDiagnostic(
      diagnostics,
      limitCode,
      basePath,
      `${basePath === "$" ? "pack" : "record"} must contain at most ${maximum} own keys`,
    );
    return { accessible: true, value: false };
  }
  for (let index = 0; index < keysAccess.value.length; index += 1) {
    const key = keysAccess.value[index];
    if (key !== undefined && (typeof key !== "string" || !allowed.has(key))) {
      addDiagnostic(
        diagnostics,
        unknownCode,
        keyPath(basePath, key),
        `unknown key: ${String(key)}`,
      );
    }
  }
  return { accessible: true, value: true };
}

export function isPortableArtifactPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_ARTIFACT_PATH_LENGTH) return false;
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("%") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    return false;
  }
  const segments = path.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (
      segment === undefined ||
      segment === "." ||
      segment === ".." ||
      !PORTABLE_SEGMENT_PATTERN.test(segment)
    ) {
      return false;
    }
  }
  return true;
}

function validateCompatibility(
  value: unknown,
  diagnostics: ValidationDiagnostic[],
): UntrustedAccess<void> {
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) return { accessible: false };
  if (!recordAccess.value) {
    addDiagnostic(diagnostics, "invalid_compatibility", "compatibility", "compatibility must be an object");
    return { accessible: true, value: undefined };
  }
  const record = value as UnknownRecord;
  const keys = validateKnownKeys(
    record,
    COMPATIBILITY_KEYS,
    MAX_PACK_NESTED_OWN_KEYS,
    "compatibility",
    "unknown_compatibility_key",
    "compatibility_key_limit_exceeded",
    diagnostics,
  );
  if (!keys.accessible) return { accessible: false };
  if (!keys.value) return { accessible: true, value: undefined };

  const graphAccess = accessUntrusted(() => record.content_graph);
  const clientAccess = accessUntrusted(() => record.client_core);
  const protocolsAccess = accessUntrusted(() => record.server_protocol);
  if (!graphAccess.accessible || !clientAccess.accessible || !protocolsAccess.accessible) {
    return { accessible: false };
  }
  if (
    typeof graphAccess.value !== "string" ||
    graphAccess.value.length === 0 ||
    graphAccess.value.length > MAX_COMPATIBILITY_STRING_LENGTH
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_content_graph_compatibility",
      "compatibility.content_graph",
      `compatibility.content_graph must be a non-empty string of at most ${MAX_COMPATIBILITY_STRING_LENGTH} characters`,
    );
  }
  if (
    typeof clientAccess.value !== "string" ||
    clientAccess.value.length === 0 ||
    clientAccess.value.length > MAX_COMPATIBILITY_STRING_LENGTH
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_client_core_compatibility",
      "compatibility.client_core",
      `compatibility.client_core must be a non-empty string of at most ${MAX_COMPATIBILITY_STRING_LENGTH} characters`,
    );
  }

  const arrayAccess = accessUntrusted(() => Array.isArray(protocolsAccess.value));
  if (!arrayAccess.accessible) return { accessible: false };
  if (!arrayAccess.value) {
    addDiagnostic(
      diagnostics,
      "invalid_server_protocols",
      "compatibility.server_protocol",
      "compatibility.server_protocol must be an array",
    );
    return { accessible: true, value: undefined };
  }
  const protocols = protocolsAccess.value as unknown[];
  const lengthAccess = accessUntrusted(() => protocols.length);
  if (!lengthAccess.accessible || !Number.isSafeInteger(lengthAccess.value) || lengthAccess.value < 0) {
    return { accessible: false };
  }
  if (lengthAccess.value > MAX_SERVER_PROTOCOLS) {
    addDiagnostic(
      diagnostics,
      "invalid_server_protocols",
      "compatibility.server_protocol",
      `compatibility.server_protocol must contain at most ${MAX_SERVER_PROTOCOLS} items`,
    );
  }
  const inspected = Math.min(lengthAccess.value, MAX_SERVER_PROTOCOLS);
  for (let index = 0; index < inspected; index += 1) {
    const protocolAccess = accessUntrusted(() => protocols[index]);
    if (!protocolAccess.accessible) return { accessible: false };
    if (
      typeof protocolAccess.value !== "string" ||
      protocolAccess.value.length === 0 ||
      protocolAccess.value.length > MAX_SERVER_PROTOCOL_LENGTH
    ) {
      addDiagnostic(
        diagnostics,
        "invalid_server_protocol",
        `compatibility.server_protocol[${index}]`,
        `server protocol must be a non-empty string of at most ${MAX_SERVER_PROTOCOL_LENGTH} characters`,
      );
    }
  }
  return { accessible: true, value: undefined };
}

function validateLicense(
  value: unknown,
  artifactIndex: number,
  diagnostics: ValidationDiagnostic[],
): UntrustedAccess<void> {
  const base = `artifacts[${artifactIndex}].license`;
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) return { accessible: false };
  if (!recordAccess.value) {
    addDiagnostic(diagnostics, "invalid_artifact_license", base, "artifact license must be an object");
    return { accessible: true, value: undefined };
  }
  const record = value as UnknownRecord;
  const keys = validateKnownKeys(
    record,
    LICENSE_KEYS,
    MAX_PACK_NESTED_OWN_KEYS,
    base,
    "unknown_license_key",
    "license_key_limit_exceeded",
    diagnostics,
  );
  if (!keys.accessible) return { accessible: false };
  if (!keys.value) return { accessible: true, value: undefined };
  const idAccess = accessUntrusted(() => record.id);
  if (!idAccess.accessible) return { accessible: false };
  if (
    typeof idAccess.value !== "string" ||
    idAccess.value.length === 0 ||
    idAccess.value.length > MAX_LICENSE_ID_LENGTH ||
    !LICENSE_ID_PATTERN.test(idAccess.value)
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_artifact_license",
      `${base}.id`,
      `artifact license id must be 1-${MAX_LICENSE_ID_LENGTH} portable characters`,
    );
  }
  return { accessible: true, value: undefined };
}

function validateProvenance(
  value: unknown,
  artifactIndex: number,
  diagnostics: ValidationDiagnostic[],
): UntrustedAccess<void> {
  const base = `artifacts[${artifactIndex}].provenance`;
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) return { accessible: false };
  if (!recordAccess.value) {
    addDiagnostic(diagnostics, "invalid_artifact_provenance", base, "artifact provenance must be an object");
    return { accessible: true, value: undefined };
  }
  const record = value as UnknownRecord;
  const keys = validateKnownKeys(
    record,
    PROVENANCE_KEYS,
    MAX_PACK_NESTED_OWN_KEYS,
    base,
    "unknown_provenance_key",
    "provenance_key_limit_exceeded",
    diagnostics,
  );
  if (!keys.accessible) return { accessible: false };
  if (!keys.value) return { accessible: true, value: undefined };
  const kindAccess = accessUntrusted(() => record.kind);
  const sourceAccess = accessUntrusted(() => record.source);
  if (!kindAccess.accessible || !sourceAccess.accessible) return { accessible: false };
  if (
    typeof kindAccess.value !== "string" ||
    !CONTENT_PROVENANCE_KINDS.includes(
      kindAccess.value as (typeof CONTENT_PROVENANCE_KINDS)[number],
    )
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_artifact_provenance_kind",
      `${base}.kind`,
      "artifact provenance kind must be original, generated, or third-party",
    );
  }
  if (
    typeof sourceAccess.value !== "string" ||
    sourceAccess.value.length === 0 ||
    sourceAccess.value.length > MAX_PROVENANCE_SOURCE_LENGTH
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_artifact_provenance_source",
      `${base}.source`,
      `artifact provenance source must be a non-empty string of at most ${MAX_PROVENANCE_SOURCE_LENGTH} characters`,
    );
  }
  return { accessible: true, value: undefined };
}

export function validateContentPackManifest(value: unknown): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) return invalidPackAccess();
  if (!recordAccess.value) {
    addDiagnostic(diagnostics, "invalid_pack", "", "pack must be a non-null object");
    return { valid: false, diagnostics };
  }
  const pack = value as UnknownRecord;
  const keys = validateKnownKeys(
    pack,
    PACK_KEYS,
    MAX_PACK_OWN_KEYS,
    "$",
    "unknown_pack_key",
    "pack_key_limit_exceeded",
    diagnostics,
  );
  if (!keys.accessible) return invalidPackAccess();
  if (!keys.value) return { valid: false, diagnostics };

  const schemaAccess = accessUntrusted(() => pack.schema);
  const idAccess = accessUntrusted(() => pack.id);
  const versionAccess = accessUntrusted(() => pack.version);
  const statusAccess = accessUntrusted(() => pack.status);
  const visibilityAccess = accessUntrusted(() => pack.visibility);
  const compatibilityAccess = accessUntrusted(() => pack.compatibility);
  const artifactsAccess = accessUntrusted(() => pack.artifacts);
  if (
    !schemaAccess.accessible ||
    !idAccess.accessible ||
    !versionAccess.accessible ||
    !statusAccess.accessible ||
    !visibilityAccess.accessible ||
    !compatibilityAccess.accessible ||
    !artifactsAccess.accessible
  ) {
    return invalidPackAccess();
  }

  if (schemaAccess.value !== "uo.game-content-pack/v1") {
    addDiagnostic(diagnostics, "invalid_pack_schema", "schema", "schema must be uo.game-content-pack/v1");
  }
  if (typeof idAccess.value !== "string" || !CONTENT_ID_PATTERN.test(idAccess.value)) {
    addDiagnostic(diagnostics, "invalid_pack_id", "id", "pack id must match the content ID pattern");
  }
  if (typeof versionAccess.value !== "string" || !SEMVER_PATTERN.test(versionAccess.value)) {
    addDiagnostic(diagnostics, "invalid_pack_version", "version", "pack version must be semantic");
  }
  if (typeof statusAccess.value !== "string" || !PACK_STATUSES.has(statusAccess.value)) {
    addDiagnostic(diagnostics, "invalid_pack_status", "status", "status must be draft, published, or deprecated");
  }
  if (typeof visibilityAccess.value !== "string" || !PACK_VISIBILITIES.has(visibilityAccess.value)) {
    addDiagnostic(diagnostics, "invalid_pack_visibility", "visibility", "visibility must be public, private, or local");
  }

  const compatibility = validateCompatibility(compatibilityAccess.value, diagnostics);
  if (!compatibility.accessible) return invalidPackAccess();

  const artifactsArrayAccess = accessUntrusted(() => Array.isArray(artifactsAccess.value));
  if (!artifactsArrayAccess.accessible) return invalidPackAccess();
  if (!artifactsArrayAccess.value) {
    addDiagnostic(diagnostics, "invalid_artifacts", "artifacts", "artifacts must be an array");
    return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
  }
  const artifacts = artifactsAccess.value as unknown[];
  const lengthAccess = accessUntrusted(() => artifacts.length);
  if (!lengthAccess.accessible || !Number.isSafeInteger(lengthAccess.value) || lengthAccess.value < 0) {
    return invalidPackAccess();
  }
  if (lengthAccess.value > MAX_PACK_ARTIFACTS) {
    addDiagnostic(
      diagnostics,
      "artifact_limit_exceeded",
      "artifacts",
      `pack must contain at most ${MAX_PACK_ARTIFACTS} artifacts`,
    );
    return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  const paths = new Set<string>();
  const contentIds = new Set<string>();
  let graphCount = 0;
  let artifactInspectionLimited = false;
  for (let index = 0; index < lengthAccess.value; index += 1) {
    const artifactAccess = accessUntrusted(() => artifacts[index]);
    if (!artifactAccess.accessible) return invalidPackAccess();
    const artifactRecordAccess = accessUntrusted(() => isRecord(artifactAccess.value));
    if (!artifactRecordAccess.accessible) return invalidPackAccess();
    if (!artifactRecordAccess.value) {
      addDiagnostic(diagnostics, "invalid_artifact", `artifacts[${index}]`, "artifact must be an object");
      continue;
    }
    const artifact = artifactAccess.value as UnknownRecord;
    const artifactKeys = validateKnownKeys(
      artifact,
      ARTIFACT_KEYS,
      MAX_ARTIFACT_OWN_KEYS,
      `artifacts[${index}]`,
      "unknown_artifact_key",
      "artifact_key_limit_exceeded",
      diagnostics,
    );
    if (!artifactKeys.accessible) return invalidPackAccess();
    if (!artifactKeys.value) {
      artifactInspectionLimited = true;
      continue;
    }

    const roleAccess = accessUntrusted(() => artifact.role);
    const contentIdAccess = accessUntrusted(() => artifact.content_id);
    const contentIdOwnAccess = accessUntrusted(() =>
      Object.prototype.hasOwnProperty.call(artifact, "content_id"),
    );
    const pathAccess = accessUntrusted(() => artifact.path);
    const hashAccess = accessUntrusted(() => artifact.sha256);
    const mediaAccess = accessUntrusted(() => artifact.media_type);
    const licenseAccess = accessUntrusted(() => artifact.license);
    const provenanceAccess = accessUntrusted(() => artifact.provenance);
    if (
      !roleAccess.accessible ||
      !contentIdAccess.accessible ||
      !contentIdOwnAccess.accessible ||
      !pathAccess.accessible ||
      !hashAccess.accessible ||
      !mediaAccess.accessible ||
      !licenseAccess.accessible ||
      !provenanceAccess.accessible
    ) {
      return invalidPackAccess();
    }

    const validRole =
      typeof roleAccess.value === "string" &&
      CONTENT_ARTIFACT_ROLES.includes(roleAccess.value as (typeof CONTENT_ARTIFACT_ROLES)[number]);
    if (!validRole) {
      addDiagnostic(
        diagnostics,
        "invalid_artifact_role",
        `artifacts[${index}].role`,
        "artifact role must be graph, entity, or asset",
      );
    } else if (roleAccess.value === "graph") {
      graphCount += 1;
      if (graphCount > 1) {
        addDiagnostic(
          diagnostics,
          "duplicate_graph_artifact",
          `artifacts[${index}].role`,
          "pack must declare exactly one graph artifact",
        );
      }
      if (contentIdOwnAccess.value) {
        addDiagnostic(
          diagnostics,
          "forbidden_content_id",
          `artifacts[${index}].content_id`,
          "graph artifact must not declare content_id",
        );
      }
    } else {
      if (
        typeof contentIdAccess.value !== "string" ||
        !CONTENT_ID_PATTERN.test(contentIdAccess.value)
      ) {
        addDiagnostic(
          diagnostics,
          "missing_content_id",
          `artifacts[${index}].content_id`,
          `${roleAccess.value} artifact must declare a valid content_id`,
        );
      } else if (contentIds.has(contentIdAccess.value)) {
        addDiagnostic(
          diagnostics,
          "duplicate_content_id",
          `artifacts[${index}].content_id`,
          `duplicate content id: ${contentIdAccess.value}`,
        );
      } else {
        contentIds.add(contentIdAccess.value);
      }
    }

    if (typeof pathAccess.value !== "string" || !isPortableArtifactPath(pathAccess.value)) {
      addDiagnostic(
        diagnostics,
        "invalid_artifact_path",
        `artifacts[${index}].path`,
        "artifact path must be a strict relative POSIX path",
      );
    } else if (paths.has(pathAccess.value)) {
      addDiagnostic(
        diagnostics,
        "duplicate_artifact_path",
        `artifacts[${index}].path`,
        `duplicate artifact path: ${pathAccess.value}`,
      );
    } else {
      paths.add(pathAccess.value);
    }
    if (typeof hashAccess.value !== "string" || !SHA256_PATTERN.test(hashAccess.value)) {
      addDiagnostic(
        diagnostics,
        "invalid_artifact_sha256",
        `artifacts[${index}].sha256`,
        "artifact sha256 must be 64 lowercase hexadecimal characters",
      );
    }
    if (
      typeof mediaAccess.value !== "string" ||
      mediaAccess.value.length > MAX_MEDIA_TYPE_LENGTH ||
      !MEDIA_TYPE_PATTERN.test(mediaAccess.value)
    ) {
      addDiagnostic(
        diagnostics,
        "invalid_artifact_media_type",
        `artifacts[${index}].media_type`,
        "artifact media_type must be a portable lowercase media type",
      );
    }
    const license = validateLicense(licenseAccess.value, index, diagnostics);
    const provenance = validateProvenance(provenanceAccess.value, index, diagnostics);
    if (!license.accessible || !provenance.accessible) return invalidPackAccess();
  }

  if (graphCount === 0 && !artifactInspectionLimited) {
    addDiagnostic(
      diagnostics,
      "missing_graph_artifact",
      "artifacts",
      "pack must declare exactly one graph artifact",
    );
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
