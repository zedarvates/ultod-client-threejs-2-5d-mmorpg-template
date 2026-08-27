# Public Extraction Design

Status: `license-review-required` — this document defines how original material may be
extracted from the private monorepo into this public template. It does not
autorise any specific file transfer yet; each extraction must pass the
[publication checklist](PUBLICATION-CHECKLIST.md) individually.

## Principles

- Only original code written specifically for this template is extractable.
- Server code, VR client code, and production tooling are never extracted.
- Each file must be independently auditable: author, provenance, license.
- Synthetic fixtures replace any real data (no player names, no IPs, no keys).
- The burden of proof is on the extractor, not the reviewer.

## File-level allowlist

The following files in this repository have been reviewed and confirmed as
original work created exclusively for this template:

| Path | Provenance | License | Reviewed | Notes |
|---|---|---|---|---|
| `src/**` | Original (this repo) | MIT | 2026-08-24 | All TypeScript modules written from scratch |
| `tests/**` | Original (this repo) | MIT | 2026-08-24 | Playwright specs + mock server |
| `docs/**` | Original (this repo) | MIT | 2026-08-24 | Architecture and protocol documentation |
| `public/blueprints/*.json` | Derived from Architecture Editor example | MIT | 2026-08-24 | Layout data only, no proprietary GLB references |
| `public/creatures/*.json` | Derived from Creature Editor example | MIT | 2026-08-24 | XenoGenome structure only |
| `index.html`, `package.json`, `tsconfig.json`, `playwright.config.ts` | Original (this repo) | MIT | 2026-08-24 | Build config |

## Explicit exclusions

The following categories are excluded by default. A binary exception requires
an explicit public redistribution license, exact SHA-256 provenance and a
review entry before extraction:

- `zig-server-v2/src/**` — all server implementation code
- `ultimate-odycer-v-rclient/**` — all Godot client code and assets
- `asset-factory/output/**` — generated GLBs (LAN GPU pipeline output)
- `creature-editor/assets/**` — XenoParts GLB library
- `architecture-editor/assets/*.glb` — building part meshes
- Any file containing credentials, endpoints, player identifiers or telemetry

## Extraction process

For each new file proposed for extraction:

1. **Identify origin** — exact source path, commit SHA and author.
2. **Verify originality** — confirm no copied logic from external projects.
3. **Sanitize** — remove all real names, IPs, tokens, absolute paths.
4. **License check** — must be MIT-eligible; no GPL/proprietary contamination.
5. **Isolate** — copy into this repo; never symlink back to monorepo.
6. **Test** — `npm run build && npm run test:e2e` passes without the source repo present.
7. **Record** — add an entry to the allowlist table above with review date.
8. **Review** — second-person approval required before push.

## Current state

Private game lore has moved to a distinct private repository. Commit `9b615ea`
remains in this public repository's history, but current `main` contains no
private game lore or private binary assets.

The public demo now uses original procedural geometry for scenery and creature
parts. The eight GLBs formerly copied from private tooling have been removed
from current `main`; their audit remains only as a historical record in
[ASSET-LICENSE-AUDIT.md](ASSET-LICENSE-AUDIT.md), with status
`release-candidate-resolved / historical-releases-annotated`.

Historical-release annotation is complete. Push, tag, release, Pages
verification, and issue closure remain deferred until approval. No binary
exception is currently approved for this repository.

The bridges (`blueprint-bridge.ts`, `creature-bridge.ts`) remain original public
code and contain no private implementation logic.
