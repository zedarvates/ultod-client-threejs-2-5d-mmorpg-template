# Binary Asset License Audit

Status: `current-release-resolved / historical-releases-annotated` (2026-08-27).

This historical record documents eight binary assets that were removed from the
`v0.1.3` release line before publication. The release is live as a non-draft,
non-prerelease `v0.1.3` publication, docs and Pages workflows succeeded, the
live bundle `index-DIPWKEzz.js` returned HTTP 200, historical notices were
confirmed true, and issue #2 is closed. This audit does not grant a license for
the historical files or make their redistribution terms complete; the
historical binaries remain unlicensed for redistribution.

## Asset Factory outputs

| Public file | Bytes | SHA-256 | Source evidence | Redistribution status |
|---|---:|---|---|---|
| `public/assets/props/ground_tile_01.glb` | 2,627,536 | `a6a5501992cc9e2a7a700f74184e190939bfe07b84faddef5cc395fbbed0f2c6` | Accepted Asset Factory run `87a30914b6484d18a4ee69244ee151df` | Pending explicit terms for `LicenseRef-UltimateOdycer-Generated-Output` |
| `public/assets/props/rock_small_01.glb` | 1,951,680 | `8726080e92aa261b4cf8d5be961951ea5bc6291dff828274581bb851a7e270db` | Existing public file does not match the run/hash previously documented | Pending source-manifest recovery and explicit license terms |

The Asset Factory currently emits the SPDX-style identifier
`LicenseRef-UltimateOdycer-Generated-Output`, but no public license text defining
reuse, modification or redistribution was found during this audit.

## XenoParts copied from Creature Editor

All six public files exactly match the private character-render manifest. The
source project root is currently marked all-rights-reserved and no separate
public redistribution grant was found.

| Public file | Bytes | SHA-256 | Redistribution status |
|---|---:|---|---|
| `public/creatures/parts/ear_wolf_01.glb` | 8,512 | `b277650e54b5ef5395265176e2c08992095e1edd87ce85c936efb6087fab32e4` | Pending explicit grant or replacement |
| `public/creatures/parts/eye_normal_01.glb` | 144,940 | `86f4c4a4bb479188ed7ce01e325cb3647885a24d9f36c5b4a3c2759e914ad64f` | Pending explicit grant or replacement |
| `public/creatures/parts/head_beak_01.glb` | 189,152 | `257fa7a3427c2aaddebab04a839d2d81b2204aa7f3e1bbcf78edd712d7f04438` | Pending explicit grant or replacement |
| `public/creatures/parts/leg_insect_01.glb` | 41,340 | `a2e9163e832bd1d7951444a4b67bd49b904a88068c3ef61f5fffd90a1161b528` | Pending explicit grant or replacement |
| `public/creatures/parts/tail_whip_01.glb` | 45,268 | `13e1b0ee7fe7744b92ae5a70d4f60a48e14347e773628f95a2e4b710252f7d6a` | Pending explicit grant or replacement |
| `public/creatures/parts/wing_bat_01.glb` | 67,224 | `8b18b1db0432748f3e439a90235c59ee7b5e9201b8fdbfeb647d7b1ecedb937b` | Pending explicit grant or replacement |

## Historical release consequence

- Existing `v0.1.0`-`v0.1.2` archives contain these files.
- Their original release-note bodies were preserved and appended with a historical
  binary-redistribution notice on 2026-08-27.
- The `v0.1.3` release uses original procedural geometry in the public demo.
- The release is published, Pages is verified, and the historical binaries are
  not relicensed by that publication.
