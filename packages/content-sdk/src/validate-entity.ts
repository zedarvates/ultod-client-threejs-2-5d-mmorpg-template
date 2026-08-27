import { CONTENT_KINDS, type ValidationDiagnostic, type ValidationResult } from "./types.js";

export const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
/** Bounds untrusted refs iteration to keep entity validation terminating. */
export const MAX_REFERENCES_PER_ENTITY = 4096;
export const MAX_COMPATIBILITY_STRING_LENGTH = 256;
export const MAX_SERVER_PROTOCOLS = 64;
export const MAX_SERVER_PROTOCOL_LENGTH = 128;

const AUTHORITIES = ["server", "client-presentation", "authoring-draft"] as const;
const STATUSES = ["draft", "published", "deprecated"] as const;

type EntityRecord = Record<string, unknown>;
type UntrustedAccess<T> = { accessible: true; value: T } | { accessible: false };

function isRecord(value: unknown): value is EntityRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDiagnostic(
  diagnostics: ValidationDiagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function accessUntrusted<T>(accessor: () => T): UntrustedAccess<T> {
  try {
    return { accessible: true, value: accessor() };
  } catch {
    return { accessible: false };
  }
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sortDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      compareOrdinal(left.code, right.code) ||
      compareOrdinal(left.path, right.path) ||
      compareOrdinal(left.message, right.message),
  );
}

function validateReferences(value: unknown, diagnostics: ValidationDiagnostic[]): boolean {
  const arrayAccess = accessUntrusted(() => Array.isArray(value));
  if (!arrayAccess.accessible) {
    return false;
  }
  if (!arrayAccess.value) {
    addDiagnostic(diagnostics, "invalid_references", "refs", "refs must be an array");
    return true;
  }

  const referencesValue = value as unknown[];
  const lengthAccess = accessUntrusted(() => referencesValue.length);
  if (!lengthAccess.accessible) {
    return false;
  }
  if (
    !Number.isSafeInteger(lengthAccess.value) ||
    lengthAccess.value < 0 ||
    lengthAccess.value > MAX_REFERENCES_PER_ENTITY
  ) {
    return false;
  }
  const references = new Set<string>();
  for (let index = 0; index < lengthAccess.value; index += 1) {
    const referenceAccess = accessUntrusted(() => referencesValue[index]);
    if (!referenceAccess.accessible) {
      return false;
    }
    const reference = referenceAccess.value;
    const recordAccess = accessUntrusted(() => isRecord(reference));
    if (!recordAccess.accessible) {
      return false;
    }
    if (!recordAccess.value) {
      addDiagnostic(
        diagnostics,
        "invalid_reference",
        `refs[${index}]`,
        "reference must include string predicate and target",
      );
      continue;
    }

    const referenceRecord = reference as EntityRecord;
    const predicateAccess = accessUntrusted(() => referenceRecord.predicate);
    const targetAccess = accessUntrusted(() => referenceRecord.target);
    if (!predicateAccess.accessible || !targetAccess.accessible) {
      return false;
    }
    if (typeof predicateAccess.value !== "string" || typeof targetAccess.value !== "string") {
      addDiagnostic(
        diagnostics,
        "invalid_reference",
        `refs[${index}]`,
        "reference must include string predicate and target",
      );
      continue;
    }

    const key = `${predicateAccess.value}\u0000${targetAccess.value}`;
    if (references.has(key)) {
      addDiagnostic(
        diagnostics,
        "duplicate_reference",
        `refs[${index}]`,
        "duplicate reference predicate and target",
      );
      continue;
    }
    references.add(key);
  }
  return true;
}

function validateCompatibility(value: unknown, diagnostics: ValidationDiagnostic[]): boolean {
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) {
    return false;
  }
  if (!recordAccess.value) {
    addDiagnostic(
      diagnostics,
      "invalid_compatibility",
      "compatibility",
      "compatibility must be an object",
    );
    return true;
  }

  const compatibility = value as EntityRecord;
  const contentGraphAccess = accessUntrusted(() => compatibility.content_graph);
  const clientCoreAccess = accessUntrusted(() => compatibility.client_core);
  const serverProtocolAccess = accessUntrusted(() => compatibility.server_protocol);
  if (!contentGraphAccess.accessible || !clientCoreAccess.accessible || !serverProtocolAccess.accessible) {
    return false;
  }

  if (
    typeof contentGraphAccess.value !== "string" ||
    contentGraphAccess.value.length === 0 ||
    contentGraphAccess.value.length > MAX_COMPATIBILITY_STRING_LENGTH
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_content_graph_compatibility",
      "compatibility.content_graph",
      `compatibility.content_graph must be a non-empty string of at most ${MAX_COMPATIBILITY_STRING_LENGTH} characters`,
    );
  }
  if (
    typeof clientCoreAccess.value !== "string" ||
    clientCoreAccess.value.length === 0 ||
    clientCoreAccess.value.length > MAX_COMPATIBILITY_STRING_LENGTH
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_client_core_compatibility",
      "compatibility.client_core",
      `compatibility.client_core must be a non-empty string of at most ${MAX_COMPATIBILITY_STRING_LENGTH} characters`,
    );
  }

  const arrayAccess = accessUntrusted(() => Array.isArray(serverProtocolAccess.value));
  if (!arrayAccess.accessible) {
    return false;
  }
  if (!arrayAccess.value) {
    addDiagnostic(
      diagnostics,
      "invalid_server_protocols",
      "compatibility.server_protocol",
      "compatibility.server_protocol must be an array",
    );
    return true;
  }

  const protocols = serverProtocolAccess.value as unknown[];
  const lengthAccess = accessUntrusted(() => protocols.length);
  if (!lengthAccess.accessible || !Number.isSafeInteger(lengthAccess.value) || lengthAccess.value < 0) {
    return false;
  }
  if (lengthAccess.value > MAX_SERVER_PROTOCOLS) {
    addDiagnostic(
      diagnostics,
      "invalid_server_protocols",
      "compatibility.server_protocol",
      `compatibility.server_protocol must contain at most ${MAX_SERVER_PROTOCOLS} items`,
    );
  }
  const inspectedLength = Math.min(lengthAccess.value, MAX_SERVER_PROTOCOLS);
  for (let index = 0; index < inspectedLength; index += 1) {
    const protocolAccess = accessUntrusted(() => protocols[index]);
    if (!protocolAccess.accessible) {
      return false;
    }
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
  return true;
}

function invalidRecordAccess(): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  addDiagnostic(diagnostics, "invalid_record_access", "$", "Entity properties could not be read");
  return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
}

export function validateEntity(value: unknown): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const entityRecordAccess = accessUntrusted(() => isRecord(value));
  if (!entityRecordAccess.accessible) {
    return invalidRecordAccess();
  }
  if (!entityRecordAccess.value) {
    addDiagnostic(diagnostics, "invalid_entity", "", "entity must be a non-null object");
    return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  const entity = value as EntityRecord;
  const schemaAccess = accessUntrusted(() => entity.schema);
  const idAccess = accessUntrusted(() => entity.id);
  const kindAccess = accessUntrusted(() => entity.kind);
  const versionAccess = accessUntrusted(() => entity.version);
  const statusAccess = accessUntrusted(() => entity.status);
  const authorityAccess = accessUntrusted(() => entity.authority);
  const compatibilityAccess = accessUntrusted(() => entity.compatibility);
  const licenseAccess = accessUntrusted(() => entity.license);
  const contentOwnAccess = accessUntrusted(() => Object.prototype.hasOwnProperty.call(entity, "content"));
  const refsAccess = accessUntrusted(() => entity.refs);
  if (
    !schemaAccess.accessible ||
    !idAccess.accessible ||
    !kindAccess.accessible ||
    !versionAccess.accessible ||
    !statusAccess.accessible ||
    !authorityAccess.accessible ||
    !compatibilityAccess.accessible ||
    !licenseAccess.accessible ||
    !contentOwnAccess.accessible ||
    !refsAccess.accessible
  ) {
    return invalidRecordAccess();
  }

  if (schemaAccess.value !== "uo.game-content-entity/v1") {
    addDiagnostic(
      diagnostics,
      "invalid_entity_schema",
      "schema",
      "schema must be uo.game-content-entity/v1",
    );
  }
  if (typeof idAccess.value !== "string" || !CONTENT_ID_PATTERN.test(idAccess.value)) {
    addDiagnostic(diagnostics, "invalid_id", "id", "id must match /^[a-z0-9][a-z0-9._-]{2,127}$/");
  }
  if (
    typeof kindAccess.value !== "string" ||
    !CONTENT_KINDS.includes(kindAccess.value as (typeof CONTENT_KINDS)[number])
  ) {
    addDiagnostic(diagnostics, "invalid_kind", "kind", "kind must be a supported content kind");
  }
  if (typeof versionAccess.value !== "string" || !SEMVER_PATTERN.test(versionAccess.value)) {
    addDiagnostic(diagnostics, "invalid_version", "version", "version must be a semantic version");
  }
  if (
    typeof statusAccess.value !== "string" ||
    !STATUSES.includes(statusAccess.value as (typeof STATUSES)[number])
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_status",
      "status",
      "status must be draft, published, or deprecated",
    );
  }
  if (
    typeof authorityAccess.value !== "string" ||
    !AUTHORITIES.includes(authorityAccess.value as (typeof AUTHORITIES)[number])
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_authority",
      "authority",
      "authority must be server, client-presentation, or authoring-draft",
    );
  }

  const licenseRecordAccess = accessUntrusted(() => isRecord(licenseAccess.value));
  if (!licenseRecordAccess.accessible) {
    return invalidRecordAccess();
  }
  let licenseId: unknown;
  if (licenseRecordAccess.value) {
    const license = licenseAccess.value as EntityRecord;
    const licenseIdAccess = accessUntrusted(() => license.id);
    if (!licenseIdAccess.accessible) {
      return invalidRecordAccess();
    }
    licenseId = licenseIdAccess.value;
  }
  if (typeof licenseId !== "string" || licenseId.length === 0) {
    addDiagnostic(diagnostics, "missing_license_id", "license.id", "license.id must be a non-empty string");
  }
  if (!validateCompatibility(compatibilityAccess.value, diagnostics)) {
    return invalidRecordAccess();
  }
  if (!contentOwnAccess.value) {
    addDiagnostic(diagnostics, "missing_content", "content", "content must be an own property");
  }
  if (!validateReferences(refsAccess.value, diagnostics)) {
    return invalidRecordAccess();
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
