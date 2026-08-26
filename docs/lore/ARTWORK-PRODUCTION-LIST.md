# Artwork Production List — The Last Open Threshold

Status: `approved design backlog`  
Depends on: [TEMPLATE-WORLD-LORE.md](TEMPLATE-WORLD-LORE.md)

## Production Rules

- Art direction: stylized low-poly 3D, hand-painted textures, isometric
  readability and tablet-safe budgets.
- Every deliverable requires an explicit public redistribution license before
  entering this repository.
- Generated outputs remain `review_only` until visual, geometry, provenance and
  license gates pass.
- Buildings should originate from Architecture Editor assemblies; creatures
  from Creature Editor workflows; isolated props from Asset Factory workflows.
- Names and prompts in this list are original template material and must not be
  replaced with Ultimate Odycer canonical assets or visual identity.

## P0 — Playable Prologue

| ID | Artwork | Type | Gameplay purpose | Recommended source | Status |
|---|---|---|---|---|---|
| CHR-P0-001 | Customizable Wayfarer base | Character + 3 LOD | Player avatar | Avatar/character pipeline | planned |
| CHR-P0-002 | Princess Seris Vale | Character + portrait | Anchor, rescue target, ally | Character pipeline | planned |
| CHR-P0-003 | King Aldric Vale | Character + portrait | Quest giver | Character pipeline | planned |
| CHR-P0-004 | Merchant Borin | Character + portrait | Trade tutorial | Character pipeline | planned |
| CRT-P0-001 | Captive Guardian | Creature + idle/hurt/release | Intro encounter | Creature Editor workflow | planned |
| ENV-P0-001 | Hearthmere starter kit | Modular environment | Spawn and market | Architecture Editor + props | planned |
| ENV-P0-002 | Whisperwood starter kit | Modular environment | Exploration route | Asset Factory workflow | planned |
| ENV-P0-003 | Broken Watchtower | Modular building | Rescue location | Architecture Editor | planned |
| PRP-P0-001 | Starter sword | Equipment prop + icon | Merchant purchase/combat gate | Asset Factory workflow | planned |
| PRP-P0-002 | Borin's market stall | Prop assembly | Merchant interaction | Architecture Editor + props | planned |
| PRP-P0-003 | Portal restraint device | Interactive prop | Controls Captive Guardian | Asset Factory workflow | planned |
| UI-P0-001 | Four dialogue portraits | 2D portraits | Dialogue identification | Portrait workflow | planned |
| UI-P0-002 | Quest and inventory icon set | 2D icon atlas | HUD readability | Icon workflow | planned |
| VFX-P0-001 | Waylight interaction glow | VFX | Interactable feedback | Procedural Three.js shader | planned |
| VFX-P0-002 | Restraint-breaking effect | VFX | Encounter resolution | Procedural particles | planned |

## P1 — Realm Identity

| ID | Artwork | Type | Gameplay purpose | Recommended source | Status |
|---|---|---|---|---|---|
| CHR-P1-001 | Warden Orin Veyr | Character + portrait | Main antagonist | Character pipeline | planned |
| CHR-P1-002 | Lantern Guild explorer | Modular NPC | Exploration quests | Character pipeline | planned |
| CHR-P1-003 | Conservatory scholar | Modular NPC | Lore and portal research | Character pipeline | planned |
| CHR-P1-004 | Closed Circle sentinel | Modular NPC | Faction opposition | Character pipeline | planned |
| ENV-P1-001 | Dawnwatch Keep | Modular landmark | Royal and Conservatory hub | Architecture Editor | planned |
| ENV-P1-002 | Glass Threshold chamber | Hero environment | Portal hub | Architecture Editor + VFX | planned |
| ART-P1-001 | Wayglass Compass | Artifact + icon | Portal discovery | Asset Factory workflow | planned |
| ART-P1-002 | Anchor Prism | Artifact + icon | Stabilization mechanic | Asset Factory workflow | planned |
| ART-P1-003 | Warden Seal | Artifact + icon | Portal locking mechanic | Asset Factory workflow | planned |
| ART-P1-004 | Lantern Ledger | Artifact + UI treatment | Ownership and trade | Asset Factory workflow | planned |
| ART-P1-005 | Shard of the Lost Realm | Artifact + VFX | Long mystery hook | Asset Factory workflow | planned |
| UI-P1-001 | Four faction crests | 2D vector/icon set | Reputation UI | Original graphic design | planned |
| UI-P1-002 | Lumeris regional map | Illustrated map | Navigation | Map workflow | planned |
| VFX-P1-001 | Stable Glass Threshold | Portal VFX | Safe travel state | Procedural Three.js shader | planned |
| VFX-P1-002 | Unstable Threshold | Portal VFX | Hazard state | Procedural Three.js shader | planned |

## P2 — Expansion Hooks

| ID | Artwork | Type | Gameplay purpose | Recommended source | Status |
|---|---|---|---|---|---|
| ENV-P2-001 | Silent Road kit | Modular environment | Act I exploration | Architecture Editor + terrain | planned |
| ENV-P2-002 | Dormant portal ruins | Modular landmark variants | Future realm hooks | Architecture Editor | planned |
| ENV-P2-003 | Realm-overlap fragment | Environment vignette | Severance demonstration | Procedural + Asset Factory | planned |
| VFX-P2-001 | Memory awakening | VFX + UI overlay | Wayfarer memories | Shader + 2D overlay | planned |
| VFX-P2-002 | Anchor stabilization ritual | VFX | Seris ability | Procedural particles | planned |
| VFX-P2-003 | Closed Circle sealing ritual | VFX | Orin faction action | Procedural particles | planned |
| CON-P2-001 | Unknown realm teaser | Key art + environment fragment | Expansion promise | Separate approved concept phase | planned |
| UI-P2-001 | Title/loading key art | 2D key art | Public presentation | Key-art workflow | planned |

## Required Views per 3D Asset

- orthographic/isometric gameplay view;
- front, side and back review views;
- silhouette at 256 px;
- material close-up;
- LOD comparison where applicable;
- tablet screenshot inside the running Three.js demo.

## Acceptance Gates

1. Originality and public-license evidence.
2. Exact SHA-256 provenance.
3. Geometry integrity and triangle budget.
4. Texture/material review.
5. Isometric readability at tablet resolution.
6. Runtime load and frame-budget evidence.
7. Human visual approval before `runtime_ready` promotion.

