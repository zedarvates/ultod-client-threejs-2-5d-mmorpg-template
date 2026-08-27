# Synthetic Tutorial World Content Pack Design

Status: `approved for implementation`
Date: `2026-08-27`
Applies to: `examples/tutorial-world/` and `@ultod/content-sdk` validation fixtures

## 1. Goal

Create the canonical public synthetic content-pack fixture `examples/tutorial-world/`.
It models a complete, closed 25-entity world spanning realm, region, biome, settlement, location, dungeon, route, factions, NPCs, quest, dialogues, items, creature species, monster variant, spawn table, encounter, vendor, and recipe.

## 2. Key Constraints

1. Complete isolation from private game lore and assets: all names, themes, and identifiers are generic synthetic tutorial content.
2. 100% compliant with `uo.game-content-entity/v1`, `uo.game-content-graph/v1`, and `uo.game-content-pack/v1`.
3. Verified by `@ultod/content-sdk` validators (`validateEntity`, `validateContentGraph`, `validateContentPackManifest`, `verifyContentPackIntegrity`, `assessContentPackPublication`).
4. Every entity file is tracked in `examples/tutorial-world/entities/` and declared in `examples/tutorial-world/pack.json` with exact SHA-256.
5. Serves as the authoritative public example for WebAdmin import, client loading, and tutorial documentation.

## 3. Directory Layout

```text
examples/tutorial-world/
  pack.json
  graph.json
  README.md
  entities/
    realm_haven.json
    region_sunlit_vale.json
    biome_temperate_grassland.json
    settlement_haven_village.json
    location_village_square.json
    location_forest_clearing.json
    route_square_to_clearing.json
    dungeon_beast_lair.json
    faction_haven_guardians.json
    npc_king_aldous.json
    npc_merchant_bram.json
    npc_princess_elara.json
    item_wooden_sword.json
    item_iron_sword.json
    item_gold_coin.json
    creature_species_forest_beast.json
    monster_variant_fierce_beast.json
    loot_table_beast_spoils.json
    spawn_table_clearing_beasts.json
    encounter_beast_ambush.json
    vendor_village_merchant.json
    recipe_sword_sharpening.json
    dialogue_king_intro.json
    dialogue_princess_thanks.json
    quest_rescue_princess.json
```
