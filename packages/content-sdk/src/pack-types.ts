export const CONTENT_ARTIFACT_ROLES = Object.freeze(["graph", "entity", "asset"] as const);

export const CONTENT_PROVENANCE_KINDS = Object.freeze([
  "original",
  "generated",
  "third-party",
] as const);

export type ContentArtifactRole = (typeof CONTENT_ARTIFACT_ROLES)[number];
export type ContentProvenanceKind = (typeof CONTENT_PROVENANCE_KINDS)[number];
export type ContentPackStatus = "draft" | "published" | "deprecated";
export type ContentPackVisibility = "public" | "private" | "local";

export interface ContentArtifact {
  role: ContentArtifactRole;
  content_id?: string;
  path: string;
  sha256: string;
  media_type: string;
  license: { id: string };
  provenance: {
    kind: ContentProvenanceKind;
    source: string;
  };
}

export interface ContentPackManifest {
  schema: "uo.game-content-pack/v1";
  id: string;
  version: string;
  status: ContentPackStatus;
  visibility: ContentPackVisibility;
  compatibility: {
    content_graph: string;
    client_core: string;
    server_protocol: string[];
  };
  artifacts: ContentArtifact[];
}

export interface ContentPackEvidenceSummary {
  artifact_count: number;
  license_ids: string[];
  provenance_kinds: ContentProvenanceKind[];
  provenance_sources: string[];
}

export type ArtifactReader = (path: string) => Promise<Uint8Array>;
