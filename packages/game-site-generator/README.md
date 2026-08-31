# `@ultod/game-site-generator`

Deterministic, text-only static website generation from an explicit
`uo.game-manifest/v1` document.

## Boundaries

- The generator does not discover lore from a content graph.
- V1 copies no image, logo, font, audio, video or other binary asset.
- The core performs no filesystem or network operation.
- Generated pages contain no script, analytics, form, iframe or runtime fetch.
- The CLI writes local files only; it does not host, deploy or publish them.
- WebAdmin and Zig-server integration are future consumers, not current behavior.

## Pure API

```ts
import {
  renderGameSite,
  validateGameManifest,
} from "@ultod/game-site-generator";

const validation = validateGameManifest(manifest, "preview");
if (!validation.valid) console.error(validation.diagnostics);

const generated = await renderGameSite(manifest, "production");
for (const file of generated.files) {
  console.log(file.path, file.sha256, file.bytes.length);
}
```

The three returned files are always `index.html`, `styles.css`, and
`site-metadata.json`. Object key insertion order is ignored; authored array
order remains presentation data.

## Modes

Preview accepts public, private, or local metadata and unresolved package/graph
references. Its page displays a preview warning and includes
`noindex,nofollow`. Those signals are not a confidentiality mechanism: private
preview files must stay in an owner-controlled environment.

Production requires `visibility: "public"`, `publication.web: true`, resolved
package versions, a safe relative content-graph path, valid HTTPS links, and an
accessible five-color theme.

## CLI

```powershell
npx ultod-game-site build `
  --manifest examples/game-site/tutorial/game.manifest.json `
  --out site/generated `
  --mode production
```

Use `--replace` only to replace an existing verified generated site. The CLI
writes and verifies a sibling staging directory before promotion. If promotion
fails, it restores the previous verified output. Ambiguous backup/staging state
is preserved for review and fails closed.

Stable exit codes:

| Code | Meaning |
|---:|---|
| 0 | success |
| 2 | manifest JSON or validation failure |
| 3 | invalid arguments or unsafe path |
| 4 | generation or staging verification failure |
| 5 | promotion, rollback, or recovery failure |

The CLI refuses filesystem roots, the repository root, the current directory,
raw `..` traversal, source/output overlap, symbolic ancestors, and non-empty
targets without explicit replacement.

## Manifest V1

Required root fields are `schema`, `id`, `name`, `version`, `visibility`,
`packages`, `content_graph`, `publication`, and `site`. The site section
contains one locale, tagline, synopsis, world copy, 1–8 features, 1–32 credits,
0–8 HTTPS links, legal text, and five six-digit theme colors. Unknown keys,
accessors, cycles, unsupported values, inaccessible contrast, and bounded-work
overflows are diagnostics.

See the neutral fixture at
[`examples/game-site/tutorial/game.manifest.json`](https://github.com/zedarvates/ultod-client-threejs-2-5d-mmorpg-template/blob/main/examples/game-site/tutorial/game.manifest.json)
and the complete
[V1 design](https://github.com/zedarvates/ultod-client-threejs-2-5d-mmorpg-template/blob/main/docs/superpowers/specs/2026-08-31-game-site-generator-v1-design.md).
