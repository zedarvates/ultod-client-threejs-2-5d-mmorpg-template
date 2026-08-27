import { CONTENT_KINDS, type ValidationDiagnostic, type ValidationResult } from "./types.js";

export const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

const AUTHORITIES = ["server", "client-presentation", "authoring-draft"] as const;

type EntityRecord = Record<string, unknown>;

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

function sortDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function validateReferences(value: unknown, diagnostics: ValidationDiagnostic[]): void {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, "invalid_references", "refs", "refs must be an array");
    return;
  }

  const references = new Set<string>();
  value.forEach((reference, index) => {
    if (!isRecord(reference) || typeof reference.predicate !== "string" || typeof reference.target !== "string") {
      addDiagnostic(
        diagnostics,
        "invalid_reference",
        `refs[${index}]`,
        "reference must include string predicate and target",
      );
      return;
    }

    const key = `${reference.predicate}\u0000${reference.target}`;
    if (references.has(key)) {
      addDiagnostic(
        diagnostics,
        "duplicate_reference",
        `refs[${index}]`,
        "duplicate reference predicate and target",
      );
      return;
    }
    references.add(key);
  });
}

export function validateEntity(value: unknown): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  if (!isRecord(value)) {
    addDiagnostic(diagnostics, "invalid_entity", "", "entity must be a non-null object");
    return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  if (typeof value.id !== "string" || !CONTENT_ID_PATTERN.test(value.id)) {
    addDiagnostic(diagnostics, "invalid_id", "id", "id must match /^[a-z0-9][a-z0-9._-]{2,127}$/");
  }
  if (typeof value.kind !== "string" || !CONTENT_KINDS.includes(value.kind as (typeof CONTENT_KINDS)[number])) {
    addDiagnostic(diagnostics, "invalid_kind", "kind", "kind must be a supported content kind");
  }
  if (typeof value.version !== "string" || !SEMVER_PATTERN.test(value.version)) {
    addDiagnostic(diagnostics, "invalid_version", "version", "version must be a semantic version");
  }
  if (typeof value.authority !== "string" || !AUTHORITIES.includes(value.authority as (typeof AUTHORITIES)[number])) {
    addDiagnostic(
      diagnostics,
      "invalid_authority",
      "authority",
      "authority must be server, client-presentation, or authoring-draft",
    );
  }

  if (!isRecord(value.license) || typeof value.license.id !== "string" || value.license.id.length === 0) {
    addDiagnostic(diagnostics, "missing_license_id", "license.id", "license.id must be a non-empty string");
  }
  validateReferences(value.refs, diagnostics);

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
