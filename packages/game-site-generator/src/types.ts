export type SiteGenerationMode = "preview" | "production";
export type GameVisibility = "public" | "private" | "local";
export type GameSiteLinkKind = "community" | "store" | "support" | "documentation";

export interface GameManifestPackages {
  client_core: string;
  content_sdk: string;
  site_generator: string;
}

export interface GameManifestFeature {
  id: string;
  title: string;
  description: string;
}

export interface GameManifestCredit {
  role: string;
  name: string;
}

export interface GameManifestLink {
  kind: GameSiteLinkKind;
  label: string;
  url: string;
}

export interface GameManifestTheme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
}

export interface GameManifestSite {
  locale: string;
  tagline: string;
  synopsis: string;
  world: {
    heading: string;
    body: string;
  };
  features: GameManifestFeature[];
  credits: GameManifestCredit[];
  legal: {
    copyright: string;
    notice: string;
  };
  links: GameManifestLink[];
  theme: GameManifestTheme;
}

export interface GameManifest {
  schema: "uo.game-manifest/v1";
  id: string;
  name: string;
  version: string;
  visibility: GameVisibility;
  packages: GameManifestPackages;
  content_graph: string;
  publication: {
    web: boolean;
    steam: boolean;
  };
  site: GameManifestSite;
}

export interface GameManifestDiagnostic {
  path: string;
  code: string;
  detail?: string;
}

export interface GameManifestValidationResult {
  valid: boolean;
  diagnostics: readonly GameManifestDiagnostic[];
  manifest?: GameManifest;
}

export type GeneratedSitePath = "index.html" | "styles.css" | "site-metadata.json";

export interface GeneratedSiteFile {
  path: GeneratedSitePath;
  mediaType:
    | "text/html; charset=utf-8"
    | "text/css; charset=utf-8"
    | "application/json";
  bytes: Uint8Array;
  sha256: string;
}

export interface GeneratedGameSite {
  manifestSha256: string;
  files: readonly GeneratedSiteFile[];
}
