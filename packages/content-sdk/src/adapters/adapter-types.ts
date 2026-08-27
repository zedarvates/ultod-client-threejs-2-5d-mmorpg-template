import type { ContentEntity, ValidationDiagnostic } from "../types.js";

export type DraftAdapterSystem = "storycore" | "legacy-registry";

export interface DraftAdapterSource {
  system: DraftAdapterSystem;
  id: string;
  version: string;
  retained: true;
}

export interface DraftAdapterResult {
  entities: ContentEntity<unknown>[];
  diagnostics: ValidationDiagnostic[];
  source: DraftAdapterSource;
}
