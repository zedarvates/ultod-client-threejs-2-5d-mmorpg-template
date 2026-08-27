import type { ContentPackManifest } from "./pack-types.js";
import { normalizeContentPackManifest } from "./normalize-pack.js";
import { normalizeContentGraph } from "./normalize.js";
import type { GameContentGraph, ValidationDiagnostic, ValidationResult } from "./types.js";
import { validateContentGraph } from "./validate-graph.js";
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

function prefixedPath(prefix: string, path: string): string {
  if (path.length === 0 || path === "$") return prefix;
  if (path.startsWith("$.")) return `${prefix}.${path.slice(2)}`;
  return `${prefix}.${path}`;
}

function addPrefixedDiagnostics(
  output: ValidationDiagnostic[],
  prefix: string,
  result: ValidationResult,
): void {
  for (let index = 0; index < result.diagnostics.length; index += 1) {
    const diagnostic = result.diagnostics[index];
    if (diagnostic === undefined) continue;
    output.push({
      code: diagnostic.code,
      path: prefixedPath(prefix, diagnostic.path),
      message: diagnostic.message,
    });
  }
}

export function assessContentPackPublication(
  manifest: ContentPackManifest,
  graph: GameContentGraph,
): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const manifestValidation = validateContentPackManifest(manifest);
  const graphValidation = validateContentGraph(graph);
  if (!manifestValidation.valid || !graphValidation.valid) {
    if (!manifestValidation.valid) addPrefixedDiagnostics(diagnostics, "manifest", manifestValidation);
    if (!graphValidation.valid) addPrefixedDiagnostics(diagnostics, "graph", graphValidation);
    return { valid: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  let normalizedManifest: ContentPackManifest;
  let normalizedGraph: GameContentGraph;
  try {
    normalizedManifest = normalizeContentPackManifest(manifest);
    normalizedGraph = normalizeContentGraph(graph);
  } catch {
    return {
      valid: false,
      diagnostics: [
        {
          code: "invalid_publication_access",
          path: "$",
          message: "manifest or graph changed during publication assessment",
        },
      ],
    };
  }

  if (normalizedManifest.status === "deprecated") {
    diagnostics.push({
      code: "deprecated_content_pack",
      path: "status",
      message: "deprecated pack cannot be published",
    });
  }
  if (normalizedManifest.visibility !== normalizedGraph.visibility) {
    diagnostics.push({
      code: "manifest_graph_visibility_mismatch",
      path: "visibility",
      message: "manifest visibility must match graph visibility",
    });
  }
  if (normalizedManifest.compatibility.server_protocol.length === 0) {
    diagnostics.push({
      code: "missing_server_protocol_compatibility",
      path: "compatibility.server_protocol",
      message: "publication requires at least one declared server protocol",
    });
  }

  const graphEntityIds = new Set<string>();
  for (let index = 0; index < normalizedGraph.entities.length; index += 1) {
    const entity = normalizedGraph.entities[index];
    if (entity !== undefined) graphEntityIds.add(entity.id);
  }

  const artifactEntityIds = new Set<string>();
  for (let index = 0; index < normalizedManifest.artifacts.length; index += 1) {
    const artifact = normalizedManifest.artifacts[index];
    if (artifact === undefined) continue;
    if (artifact.role === "graph" && artifact.media_type !== "application/json") {
      diagnostics.push({
        code: "invalid_graph_artifact_media_type",
        path: `manifest.artifacts[${index}].media_type`,
        message: "graph artifact must use application/json",
      });
    }
    if (artifact.role !== "entity") continue;
    if (artifact.media_type !== "application/json") {
      diagnostics.push({
        code: "invalid_entity_artifact_media_type",
        path: `manifest.artifacts[${index}].media_type`,
        message: "entity artifacts must use application/json",
      });
    }
    const contentId = artifact.content_id;
    if (contentId === undefined) continue;
    artifactEntityIds.add(contentId);
    if (!graphEntityIds.has(contentId)) {
      diagnostics.push({
        code: "orphan_entity_artifact",
        path: `manifest.artifacts[${index}].content_id`,
        message: `manifest entity artifact is absent from graph: ${contentId}`,
      });
    }
  }

  for (let index = 0; index < normalizedGraph.entities.length; index += 1) {
    const entity = normalizedGraph.entities[index];
    if (entity !== undefined && !artifactEntityIds.has(entity.id)) {
      diagnostics.push({
        code: "missing_entity_artifact",
        path: `graph.entities[${index}].id`,
        message: `graph entity has no manifest artifact: ${entity.id}`,
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
