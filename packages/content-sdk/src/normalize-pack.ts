import type {
  ContentArtifact,
  ContentArtifactRole,
  ContentPackEvidenceSummary,
  ContentPackManifest,
  ContentPackStatus,
  ContentPackVisibility,
  ContentProvenanceKind,
} from "./pack-types.js";
import { validateContentPackManifest } from "./validate-pack.js";

export class ContentPackCanonicalizationError extends TypeError {
  readonly code: string;
  readonly path: string;

  constructor(path: string, code: string) {
    super(`Content pack canonicalization failed with ${code} at ${path}`);
    this.name = "ContentPackCanonicalizationError";
    this.code = code;
    this.path = path;
  }
}

function fail(path: string, code: string): never {
  throw new ContentPackCanonicalizationError(path, code);
}

function readAccess<T>(path: string, reader: () => T): T {
  try {
    return reader();
  } catch (error) {
    if (error instanceof ContentPackCanonicalizationError) throw error;
    return fail(path, "invalid_pack_access");
  }
}

function requireString(path: string, value: unknown): string {
  return typeof value === "string" ? value : fail(path, "invalid_pack_access");
}

function requireRecord(path: string, value: unknown): Record<string, unknown> {
  const valid = readAccess(
    path,
    () => value !== null && typeof value === "object" && !Array.isArray(value),
  );
  return valid ? (value as Record<string, unknown>) : fail(path, "invalid_pack_access");
}

function requireArray(path: string, value: unknown): unknown[] {
  return readAccess(path, () => Array.isArray(value))
    ? (value as unknown[])
    : fail(path, "invalid_pack_access");
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareArtifacts(left: ContentArtifact, right: ContentArtifact): number {
  return (
    compareOrdinal(left.role, right.role) ||
    compareOrdinal(left.content_id ?? "", right.content_id ?? "") ||
    compareOrdinal(left.path, right.path) ||
    compareOrdinal(left.sha256, right.sha256)
  );
}

function normalizeProtocols(compatibility: Record<string, unknown>): string[] {
  const protocolsValue = readAccess("compatibility.server_protocol", () =>
    Reflect.get(compatibility, "server_protocol"),
  );
  const protocolsRecord = requireArray("compatibility.server_protocol", protocolsValue);
  const length = readAccess("compatibility.server_protocol", () => protocolsRecord.length);
  if (!Number.isSafeInteger(length) || length < 0) {
    return fail("compatibility.server_protocol", "invalid_pack_access");
  }
  const protocols: string[] = [];
  for (let index = 0; index < length; index += 1) {
    protocols.push(
      requireString(
        `compatibility.server_protocol[${index}]`,
        readAccess(`compatibility.server_protocol[${index}]`, () => protocolsRecord[index]),
      ),
    );
  }
  return protocols;
}

function normalizeArtifact(value: unknown, index: number): ContentArtifact {
  const base = `artifacts[${index}]`;
  const record = requireRecord(base, value);
  const role = requireString(`${base}.role`, readAccess(`${base}.role`, () => Reflect.get(record, "role"))) as ContentArtifactRole;
  const path = requireString(`${base}.path`, readAccess(`${base}.path`, () => Reflect.get(record, "path")));
  const sha256 = requireString(
    `${base}.sha256`,
    readAccess(`${base}.sha256`, () => Reflect.get(record, "sha256")),
  );
  const mediaType = requireString(
    `${base}.media_type`,
    readAccess(`${base}.media_type`, () => Reflect.get(record, "media_type")),
  );
  const licenseValue = readAccess(`${base}.license`, () => Reflect.get(record, "license"));
  const provenanceValue = readAccess(`${base}.provenance`, () => Reflect.get(record, "provenance"));
  const licenseRecord = requireRecord(`${base}.license`, licenseValue);
  const provenanceRecord = requireRecord(`${base}.provenance`, provenanceValue);
  const licenseId = requireString(
    `${base}.license.id`,
    readAccess(`${base}.license.id`, () => Reflect.get(licenseRecord, "id")),
  );
  const provenanceKind = requireString(
    `${base}.provenance.kind`,
    readAccess(`${base}.provenance.kind`, () => Reflect.get(provenanceRecord, "kind")),
  ) as ContentProvenanceKind;
  const provenanceSource = requireString(
    `${base}.provenance.source`,
    readAccess(`${base}.provenance.source`, () => Reflect.get(provenanceRecord, "source")),
  );

  const common = {
    role,
    path,
    sha256,
    media_type: mediaType,
    license: { id: licenseId },
    provenance: { kind: provenanceKind, source: provenanceSource },
  };
  if (role === "graph") return common;
  const contentId = requireString(
    `${base}.content_id`,
    readAccess(`${base}.content_id`, () => Reflect.get(record, "content_id")),
  );
  return {
    role,
    content_id: contentId,
    path,
    sha256,
    media_type: mediaType,
    license: { id: licenseId },
    provenance: { kind: provenanceKind, source: provenanceSource },
  };
}

export function normalizeContentPackManifest(manifest: ContentPackManifest): ContentPackManifest {
  const validation = validateContentPackManifest(manifest);
  if (!validation.valid) {
    const diagnostic = validation.diagnostics[0];
    return diagnostic === undefined
      ? fail("$", "invalid_pack")
      : fail(diagnostic.path, diagnostic.code);
  }

  const record = manifest as unknown as Record<string, unknown>;
  const compatibilityValue = readAccess("compatibility", () => Reflect.get(record, "compatibility"));
  const artifactsValue = readAccess("artifacts", () => Reflect.get(record, "artifacts"));
  const compatibilityRecord = requireRecord("compatibility", compatibilityValue);
  const artifactsRecord = requireArray("artifacts", artifactsValue);

  const artifactLength = readAccess("artifacts", () => artifactsRecord.length);
  if (!Number.isSafeInteger(artifactLength) || artifactLength < 0) {
    return fail("artifacts", "invalid_pack_access");
  }
  const artifacts: ContentArtifact[] = [];
  for (let index = 0; index < artifactLength; index += 1) {
    artifacts.push(
      normalizeArtifact(
        readAccess(`artifacts[${index}]`, () => artifactsRecord[index]),
        index,
      ),
    );
  }
  artifacts.sort(compareArtifacts);

  return {
    schema: requireString("schema", readAccess("schema", () => Reflect.get(record, "schema"))) as "uo.game-content-pack/v1",
    id: requireString("id", readAccess("id", () => Reflect.get(record, "id"))),
    version: requireString("version", readAccess("version", () => Reflect.get(record, "version"))),
    status: requireString("status", readAccess("status", () => Reflect.get(record, "status"))) as ContentPackStatus,
    visibility: requireString(
      "visibility",
      readAccess("visibility", () => Reflect.get(record, "visibility")),
    ) as ContentPackVisibility,
    compatibility: {
      content_graph: requireString(
        "compatibility.content_graph",
        readAccess("compatibility.content_graph", () => Reflect.get(compatibilityRecord, "content_graph")),
      ),
      client_core: requireString(
        "compatibility.client_core",
        readAccess("compatibility.client_core", () => Reflect.get(compatibilityRecord, "client_core")),
      ),
      server_protocol: normalizeProtocols(compatibilityRecord),
    },
    artifacts,
  };
}

export function serializeCanonicalContentPack(manifest: ContentPackManifest): string {
  return JSON.stringify(normalizeContentPackManifest(manifest));
}

export function summarizeContentPackEvidence(
  manifest: ContentPackManifest,
): ContentPackEvidenceSummary {
  const normalized = normalizeContentPackManifest(manifest);
  const licenseIds = new Set<string>();
  const provenanceKinds = new Set<ContentProvenanceKind>();
  const provenanceSources = new Set<string>();
  for (let index = 0; index < normalized.artifacts.length; index += 1) {
    const artifact = normalized.artifacts[index];
    if (artifact === undefined) continue;
    licenseIds.add(artifact.license.id);
    provenanceKinds.add(artifact.provenance.kind);
    provenanceSources.add(artifact.provenance.source);
  }
  return {
    artifact_count: normalized.artifacts.length,
    license_ids: Array.from(licenseIds).sort(compareOrdinal),
    provenance_kinds: Array.from(provenanceKinds).sort(compareOrdinal),
    provenance_sources: Array.from(provenanceSources).sort(compareOrdinal),
  };
}
