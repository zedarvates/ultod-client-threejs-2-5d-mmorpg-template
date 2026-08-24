# Generated Asset Provenance

Status: `accepted` (Asset Factory quality gates passed).

These assets were generated locally with the Ultimate Odycer Asset Factory
(Trellis2 image-to-mesh pipeline on the operator LAN). Each GLB is pinned to
its source run by SHA-256. The full manifests live in the private tooling
repository; only names, hashes and provenance are mirrored here.

| File | Source asset | Run ID | SHA-256 | Triangles | License |
|---|---|---|---|---|---|
| ground_tile_01.glb | Template_Ground_Tile_01 | 87a30914b6484d18a4ee69244ee151df | a6a5501992cc9e2a...f2c6 (full hash in source manifest) | 759 | Ultimate Odycer Generated Output |
| rock_small_01.glb | Template_Rock_Small_01 | 06331cd667414565a9c05762ab09c858 | 8ffcb700f6b18ff8... (full hash in source manifest) | 582 | Ultimate Odycer Generated Output |

## Rules

- No player data, production endpoint or credential is embedded in any asset.
- Assets must never be re-exported without updating this provenance table.
- Tree and crate assets remain under review; they will be added here only after acceptance.
