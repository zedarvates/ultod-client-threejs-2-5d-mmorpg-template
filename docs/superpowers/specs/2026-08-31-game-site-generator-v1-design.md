# Deterministic Game Site Generator V1 Design

Date: 2026-08-31  
Status: approved design, implementation not started

## 1. Purpose

Create a public package, `@ultod/game-site-generator`, that turns one strictly
validated `uo.game-manifest/v1` document into a deterministic, accessible,
single-page static website.

V1 deliberately uses only text and a bounded CSS theme. It never discovers
content from a game graph, imports private lore, embeds media, calls a network
service, or publishes a site. The author explicitly chooses every string that
may appear in the generated website.

## 2. Boundaries

### In scope

- strict manifest types, validation, normalization and SHA-256 hashing;
- preview and production generation modes;
- pure in-memory rendering of `index.html`, `styles.css` and
  `site-metadata.json`;
- a Node.js CLI that writes through staging and rollback;
- one neutral synthetic fixture for documentation and tests;
- deterministic, security, accessibility and failure-path tests.

### Out of scope

- images, logos, galleries, fonts, audio, video or copied assets;
- deriving marketing text from a content graph;
- multi-page output, localization bundles, analytics or cookies;
- server-status requests or any other generated runtime network request;
- hosting, deployment, DNS, WebAdmin or Zig-server mutations;
- Steam packaging;
- changing an existing private game manifest automatically.

## 3. Package boundary

The package is a new workspace at `packages/game-site-generator/`. It owns the
game-manifest contract because the contract controls game presentation and site
publication, not runtime content entities. `@ultod/content-sdk` remains focused
on content graphs and packs.

The package has two layers:

1. a pure core that accepts values and returns values, with no filesystem or
   network access;
2. a Node.js CLI adapter that reads one manifest and transactionally writes one
   output directory.

V1 targets Node.js 22 or newer. The package has no runtime dependency on the
Three.js client or on a private repository.

## 4. Manifest contract

The root schema is closed: every unknown own key is a diagnostic. Nested
objects are also closed. Inherited properties are ignored and access failures
become diagnostics rather than uncaught exceptions.

```json
{
  "schema": "uo.game-manifest/v1",
  "id": "game.tutorial-frontier",
  "name": "Frontier Tutorial",
  "version": "0.1.0",
  "visibility": "public",
  "packages": {
    "client_core": "^0.1.0",
    "content_sdk": "^0.1.0",
    "site_generator": "^0.1.0"
  },
  "content_graph": "content/graph.json",
  "publication": {
    "web": true,
    "steam": false
  },
  "site": {
    "locale": "en",
    "tagline": "A small world built to teach the public workflow.",
    "synopsis": "Explore a synthetic frontier and learn how portable game content becomes a playable preview.",
    "world": {
      "heading": "A neutral frontier",
      "body": "Three presentation-only locations demonstrate movement, maps and content boundaries."
    },
    "features": [
      {
        "id": "isometric-exploration",
        "title": "Isometric exploration",
        "description": "Move through deterministic local previews with keyboard, pointer or touch."
      }
    ],
    "credits": [
      {
        "role": "Template",
        "name": "Ultimate Odycer contributors"
      }
    ],
    "legal": {
      "copyright": "Copyright (c) 2026 Ultimate Odycer contributors.",
      "notice": "Synthetic tutorial content. See the repository for individual licenses."
    },
    "links": [
      {
        "kind": "documentation",
        "label": "Documentation",
        "url": "https://example.invalid/docs"
      }
    ],
    "theme": {
      "background": "#101419",
      "surface": "#1c2530",
      "text": "#f4ecd8",
      "muted": "#c4bca8",
      "accent": "#e1ad55"
    }
  }
}
```

### 4.1 Root fields

- `schema` is exactly `uo.game-manifest/v1`.
- `id` matches `^game\.[a-z][a-z0-9-]{2,63}$`.
- `name` contains 1 to 120 Unicode scalar values after trimming.
- `version` is a SemVer value, including a legal prerelease suffix.
- `visibility` is `public`, `private` or `local`.
- `packages` contains exactly `client_core`, `content_sdk` and
  `site_generator`.
- `content_graph` is either `unresolved` in preview mode or a safe relative
  POSIX JSON path.
- `publication` contains exactly the booleans `web` and `steam`.
- `site` is required for site generation.

Package values are either `unresolved` in preview mode or bounded npm-style
SemVer ranges. The V1 validator accepts only a documented conservative subset:
an exact SemVer value or one exact value prefixed by `^`, `~`, `>=` or `<=`.
Compound ranges and tags are rejected until a later schema version defines
their meaning.

### 4.2 Site fields

- `locale` is one lowercase language code with an optional uppercase region,
  for example `en` or `fr-CA`; V1 generates one locale only.
- `tagline` is 1 to 180 scalar values.
- `synopsis` is 1 to 2,000 scalar values.
- `world.heading` is 1 to 100 scalar values.
- `world.body` is 1 to 2,000 scalar values.
- `features` contains 1 to 8 entries with unique safe IDs, titles up to 100
  scalar values and descriptions up to 600 scalar values.
- `credits` contains 1 to 32 role/name pairs, each bounded to 120 scalar
  values.
- `legal.copyright` is 1 to 240 scalar values.
- `legal.notice` is 1 to 1,200 scalar values.
- `links` contains 0 to 8 entries. `kind` is `community`, `store`, `support` or
  `documentation`; labels are bounded to 80 scalar values; URLs must use HTTPS,
  contain no credentials and have no fragment-only or script-like form.
- every theme value is exactly a six-digit hexadecimal color.

Feature, credit and link array order is presentation data and remains authored
order. Object-key insertion order is not semantic and is normalized.

### 4.3 Theme accessibility

The validator computes WCAG relative luminance and contrast. It requires:

- `text` against both `background` and `surface`: at least 4.5:1;
- `muted` against both `background` and `surface`: at least 4.5:1;
- `accent` against both `background` and `surface`: at least 3:1.

Equal colors and transparent or shortened color forms are rejected. V1 uses
`accent` only for focus outlines, borders and large decorative elements, never
as normal-size body text.

## 5. Validation modes and diagnostics

`preview` permits any visibility, `unresolved` package values and an unresolved
content graph. Generated preview output always includes a visible preview
banner and `robots` directives that forbid indexing. These signals reduce
accidental exposure but are not an authorization or confidentiality mechanism;
preview output containing private text must remain in an owner-controlled
environment.

`production` requires:

- `visibility: public`;
- `publication.web: true`;
- no unresolved package value;
- a safe resolved content-graph path;
- all ordinary structural and contrast checks to pass.

Steam publication has no effect in V1.

Validation returns deterministic diagnostics:

```ts
interface GameManifestDiagnostic {
  path: string;
  code: string;
  detail?: string;
}
```

Diagnostics sort by path, code and detail. Public functions do not throw for
malformed input, hostile accessors, proxies, cycles, oversized arrays or
unsupported values. Work limits cap own keys, depth, nodes, strings and array
items before canonical expansion. Required fields must be own properties.

V1 exports and enforces these global ceilings before field-specific limits:

- `MAX_MANIFEST_DEPTH = 8`;
- `MAX_MANIFEST_NODES = 512`;
- `MAX_MANIFEST_OWN_KEYS = 32` per object;
- `MAX_MANIFEST_ARRAY_ITEMS = 32` per array;
- `MAX_MANIFEST_STRING_LENGTH = 2000` scalar values;
- `MAX_MANIFEST_DIAGNOSTICS = 256`.

If a ceiling is exceeded, validation emits one stable limit diagnostic for the
affected path and does not expand that subtree. Exact constants are covered by
adversarial tests.

## 6. Core API and data flow

```ts
type SiteGenerationMode = "preview" | "production";

interface GeneratedSiteFile {
  path: "index.html" | "styles.css" | "site-metadata.json";
  mediaType: "text/html; charset=utf-8" | "text/css; charset=utf-8" | "application/json";
  bytes: Uint8Array;
  sha256: string;
}

interface GeneratedGameSite {
  manifestSha256: string;
  files: readonly GeneratedSiteFile[];
}

validateGameManifest(value: unknown, mode: SiteGenerationMode): GameManifestDiagnostic[];
normalizeGameManifest(manifest: GameManifest): GameManifest;
serializeCanonicalGameManifest(manifest: GameManifest): string;
sha256CanonicalGameManifest(manifest: GameManifest): Promise<string>;
renderGameSite(value: unknown, mode: SiteGenerationMode): Promise<GeneratedGameSite>;
```

`renderGameSite` validates first and throws one typed
`GameSiteGenerationError` containing the complete bounded diagnostic list when
validation fails. It never returns partial files.

Normalization sorts object keys recursively while preserving semantically
ordered arrays. Hashes use UTF-8 bytes and lowercase SHA-256 hex. File order is
always `index.html`, `styles.css`, `site-metadata.json`.

## 7. Output contract

`index.html` contains semantic landmarks: skip link, header, navigation, main,
feature list, world section, credits and footer. It has no inline event handler,
script, form, iframe, remote stylesheet or runtime fetch. All authored text and
attributes are contextually escaped.

`styles.css` is generated only from fixed template tokens and validated color
values. No manifest value can become a selector, property name, URL, font name
or arbitrary CSS fragment. The layout supports keyboard focus, reduced motion,
narrow tablets and wide desktop screens.

`site-metadata.json` contains:

- schema `uo.generated-game-site/v1`;
- generator package version;
- generation mode;
- game ID and version;
- canonical manifest SHA-256;
- byte length and SHA-256 for `index.html` and `styles.css`.

The metadata file does not contain its own hash, avoiding a circular value. Its
hash remains available in the returned `GeneratedSiteFile` record.

Generated bytes contain no timestamp, machine path, hostname, random value or
environment-dependent newline. The same package version, mode and canonical
manifest produce byte-identical output.

## 8. CLI and transactional writing

The package exposes:

```text
ultod-game-site build --manifest <file> --out <directory> --mode preview|production [--replace]
```

The CLI performs no network request. It resolves manifest and output paths,
then refuses:

- a filesystem root, drive root, repository root or current directory;
- any raw output argument containing a `..` path segment;
- symbolic links or junctions in the target chain;
- a non-empty output directory unless `--replace` is explicit;
- source and output paths that overlap.

Generation occurs in a unique sibling staging directory on the same volume.
The CLI writes all bytes, reads them back, verifies lengths and hashes, then:

1. renames an existing output to one sibling backup when replacement is
   authorized;
2. renames staging to the final output;
3. removes the backup only after the final directory verifies;
4. restores the backup if promotion fails.

A later run detects an interrupted staging or backup state. It restores a
missing final directory from the verified backup, otherwise leaves evidence in
place and fails with a precise recovery diagnostic. V1 describes this as a
transactional swap with rollback, not as a universally atomic directory
replacement on Windows.

The transactional writer is implemented against a small internal filesystem
adapter. Production uses Node filesystem primitives; tests inject deterministic
failures at write, read-back, rename, verification and cleanup boundaries.

Exit codes are stable: `0` success, `2` validation, `3` unsafe path, `4`
generation or verification, and `5` promotion or recovery failure. Diagnostics
go to stderr; successful machine-readable metadata goes to stdout.

## 9. Error handling

- Invalid manifest: return all bounded diagnostics and write nothing.
- Rendering failure: return no files and write nothing.
- Existing target without `--replace`: fail without mutation.
- Staging write or verification failure: remove only the known staging
  directory; preserve the current output.
- Promotion failure: restore the verified backup and report the exact state.
- Recovery ambiguity: fail closed and preserve all evidence for manual review.

The CLI never follows a discovered symlink, broad glob or unresolved
environment variable for a destructive operation.

## 10. Testing strategy

### Contract tests

- public exports and compile-time manifest shapes;
- exact preview and production acceptance cases;
- unknown, inherited and throwing keys;
- duplicate IDs, unsafe paths, unresolved production values and non-HTTPS URLs;
- depth, node, own-key, string and collection bounds;
- contrast calculations and boundary ratios.

### Determinism and security tests

- object insertion order does not change canonical bytes or generated files;
- authored array order remains visible and changes the hash;
- repeated generation produces byte-identical output;
- HTML text, attribute and URL payloads cannot inject markup or scripts;
- CSS is composed only from fixed declarations and validated colors;
- output contains no private sample names, machine paths or timestamps.

### CLI tests

- clean output creation and hash verification;
- refusal of roots, traversal, overlap, symlinks and non-empty targets;
- simulated write, verification and promotion failures;
- previous output preservation and backup restoration;
- interrupted-state recovery without deleting ambiguous evidence.

### Browser tests

Playwright serves the generated synthetic fixture on an isolated port and
checks:

- document title, locale, landmarks, headings and skip link;
- keyboard navigation and visible focus;
- 320-pixel tablet layout and desktop layout without horizontal overflow;
- reduced-motion behavior;
- no network request after the initial local document and stylesheet;
- preview banner and no-index metadata;
- production output contains no preview banner.

## 11. Repository integration

Implementation adds:

- `packages/game-site-generator/`;
- root workspace scripts for typecheck, build, tests and package-consumer smoke;
- a synthetic manifest under a public example directory;
- focused tests under `tests/`;
- package and CLI documentation;
- CI coverage in the existing validation workflow.

The private game repository is not modified by this implementation. Its
existing minimal manifest remains valid private metadata but is not a valid V1
site-generation input until an owner explicitly adds the `site` section.

## 12. Acceptance criteria

- The public package contains no private-game identity or content.
- One synthetic preview and one synthetic production fixture validate.
- Invalid or hostile input yields deterministic bounded diagnostics.
- The pure core makes no filesystem or network call.
- The CLI preserves the previous site across every simulated failure.
- The same canonical input produces byte-identical files and hashes.
- Production generation fails closed unless visibility and web-publication
  gates are explicit.
- The generated page passes the specified keyboard, responsive and no-network
  browser tests.
- Existing client, content SDK, package-consumer and public-boundary checks stay
  green.
