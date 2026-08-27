import type { ArtifactReader, ContentPackManifest } from "./pack-types.js";
import { normalizeContentPackManifest } from "./normalize-pack.js";
import { sha256Bytes } from "./sha256.js";
import type { ValidationDiagnostic, ValidationResult } from "./types.js";
import { validateContentPackManifest } from "./validate-pack.js";

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

export async function verifyContentPackIntegrity(
  manifest: ContentPackManifest,
  readArtifact: ArtifactReader,
): Promise<ValidationResult> {
  const validation = validateContentPackManifest(manifest);
  if (!validation.valid) return validation;

  const normalized = normalizeContentPackManifest(manifest);
  const diagnostics: ValidationDiagnostic[] = [];
  for (let index = 0; index < normalized.artifacts.length; index += 1) {
    const artifact = normalized.artifacts[index];
    if (artifact === undefined) continue;
    let bytes: unknown;
    try {
      bytes = await readArtifact(artifact.path);
      if (!(bytes instanceof Uint8Array)) throw new TypeError("reader must return Uint8Array");
      const actual = await sha256Bytes(bytes);
      if (actual !== artifact.sha256) {
        diagnostics.push({
          code: "artifact_hash_mismatch",
          path: `artifacts[${index}].sha256`,
          message: `artifact sha256 does not match declared value: ${artifact.path}`,
        });
      }
    } catch {
      diagnostics.push({
        code: "artifact_unavailable",
        path: `artifacts[${index}].path`,
        message: `artifact unavailable: ${artifact.path}`,
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
