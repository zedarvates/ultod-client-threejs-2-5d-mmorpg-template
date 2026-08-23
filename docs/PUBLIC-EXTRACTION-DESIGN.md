# Public Extraction Design

Status: `decision` for the extraction method. Future starter files MUST be
original, isolated, and created inside this repository. Existing Ultimate
Odycer client or server files MUST NOT be copied, renamed, or vendored.

The extraction unit is one file. A directory, scene tree, or Git history is
not an allowlist.

## Source boundary

| Source | Allowed use | Forbidden use |
|---|---|---|
| This repository's documentation | continue and refine | treat docs as a playable client |
| [ultimate-odycer-docs](https://github.com/zedarvates/ultimate-odycer-docs) public contracts | consume published authority rules and `network-intent-v1` as documentation | invent opcodes or live endpoints |
| [ultod-json-template-registry](https://github.com/zedarvates/ultod-json-template-registry) | pin reviewed snapshots by version and SHA-256 | auto-download at runtime or treat templates as grants |
| Existing Ultimate Odycer client code | none | copy, rewrite-in-place, or "clean up" proprietary code |
| Zig server, WebAdmin, production configs | none | protocol dumps, binaries, credentials, billing |
| Third-party Web / Three.js samples | only permissively licensed, file-audited, attributed originals | unaudited assets, brands, or unknown licenses |

## File-level allowlist for the Three.js 2.5D original shell

| Planned path | Purpose | License | Authority |
|---|---|---|---|
| `package.json` | web project metadata & dependencies | MIT, this repository | none |
| `tsconfig.json` | TypeScript compiler configuration | MIT, original | none |
| `index.html` | responsive canvas container and UI overlay | MIT, original | none |
| `src/main.ts` | Three.js isometric scene, lights, renderer, loop | MIT, original | none |
| `src/player_presentation.ts` | local 2.5D presentation of a server entity | MIT, original | presentation only |
| `src/npc_presentation.ts` | interaction prompt and NPC 2.5D representation | MIT, original | presentation only |
| `src/controls/isometric_controls.ts` | click-to-move and keyboard isometric calculation | MIT, original | discarded if a future server rejects it |
| `net/intent_contract.md` | maps public `network-intent-v1` families to client methods | MIT, documentation | no live socket |
| `content/pinned_templates.md` | records pinned registry versions and SHA-256 | MIT, documentation | templates never grant gold, items, or speed |
| `tests/synthetic_fixtures/` | names like `player_demo_01`, never live ids | MIT, original | synthetic only |

Anything not listed is denied until a new audited row is added.

## Denied classes

- any path from an existing Ultimate Odycer client checkout;
- bundled client binaries, obfuscated packs, or minified private bundles;
- protocol captures, TLS materials, realm URLs, or player identifiers;
- WebAdmin, billing, moderation, or commercial configuration;
- unaudited 3D models, textures, audio, brand marks, or third-party packs;
- a network client before [SERVER-COMPATIBILITY.md](SERVER-COMPATIBILITY.md) is resolved.

## License audit

- Future original starter files: MIT, as declared in [LICENSE](../LICENSE).
- Documentation already in this repository: remains documentation, not a game asset grant.
- JSON registry snapshots: Apache-2.0 in their own repository; pin and attribute, do not relicense.
- Three.js library: MIT license, external dependency.
- Ultimate Odycer name, proprietary server, hosted services, and commercial components: no license is granted here.

## Non-claims

This document does not prove that a playable web MMO exists, that performance is certified across all browsers/devices, or that a server will accept a client. Missing evidence stays unsupported.
