# Synthetic Tutorial World Content Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, validated synthetic `examples/tutorial-world/` content pack and comprehensive integration tests.

**Architecture:** 25 individual entity files are created under `examples/tutorial-world/entities/`, assembled into `graph.json`, and inventoried with exact SHA-256 in `pack.json`. An automated integration test suite verifies structural compliance, integrity verification, publication readiness, and client-core mounting.

**Tech Stack:** TypeScript 5.6, `@ultod/content-sdk`, `@ultod/threejs-client-core`, Node.js crypto, Playwright Test

**Spec:** `docs/superpowers/specs/2026-08-27-synthetic-tutorial-world-pack-design.md`

## Global Constraints

- All entity schemas must be `uo.game-content-entity/v1`.
- Graph schema must be `uo.game-content-graph/v1`.
- Pack schema must be `uo.game-content-pack/v1`.
- No dangling references; graph must be closed.
- Zero private game names, lore, or binary assets.

---

### Task 1: Create Entity Files for World, Society, and Gameplay Families

**Files:**
- Create: `examples/tutorial-world/entities/realm_haven.json`
- Create: `examples/tutorial-world/entities/region_sunlit_vale.json`
- Create: `examples/tutorial-world/entities/biome_temperate_grassland.json`
- Create: `examples/tutorial-world/entities/settlement_haven_village.json`
- Create: `examples/tutorial-world/entities/location_village_square.json`
- Create: `examples/tutorial-world/entities/location_forest_clearing.json`
- Create: `examples/tutorial-world/entities/route_square_to_clearing.json`
- Create: `examples/tutorial-world/entities/dungeon_beast_lair.json`
- Create: `examples/tutorial-world/entities/faction_haven_guardians.json`
- Create: `examples/tutorial-world/entities/npc_king_aldous.json`
- Create: `examples/tutorial-world/entities/npc_merchant_bram.json`
- Create: `examples/tutorial-world/entities/npc_princess_elara.json`
- Create: `examples/tutorial-world/entities/item_wooden_sword.json`
- Create: `examples/tutorial-world/entities/item_iron_sword.json`
- Create: `examples/tutorial-world/entities/item_gold_coin.json`
- Create: `examples/tutorial-world/entities/creature_species_forest_beast.json`
- Create: `examples/tutorial-world/entities/monster_variant_fierce_beast.json`
- Create: `examples/tutorial-world/entities/loot_table_beast_spoils.json`
- Create: `examples/tutorial-world/entities/spawn_table_clearing_beasts.json`
- Create: `examples/tutorial-world/entities/encounter_beast_ambush.json`
- Create: `examples/tutorial-world/entities/vendor_village_merchant.json`
- Create: `examples/tutorial-world/entities/recipe_sword_sharpening.json`
- Create: `examples/tutorial-world/entities/dialogue_king_intro.json`
- Create: `examples/tutorial-world/entities/dialogue_princess_thanks.json`
- Create: `examples/tutorial-world/entities/quest_rescue_princess.json`
- Create: `tests/tutorial-world-entities.spec.ts`

- [ ] **Step 1: Write RED test asserting all 25 entity files exist and pass validateEntity**
- [ ] **Step 2: Generate all 25 validated entity JSON files**
- [ ] **Step 3: Run test to verify GREEN**
- [ ] **Step 4: Commit Task 1**

---

### Task 2: Build and Validate Graph and Pack Manifest

**Files:**
- Create: `examples/tutorial-world/graph.json`
- Create: `examples/tutorial-world/pack.json`
- Create: `examples/tutorial-world/README.md`
- Create: `tests/tutorial-world-pack.spec.ts`

- [ ] **Step 1: Write test verifying graph closure, cycle freedom, pack integrity and publication assessment**
- [ ] **Step 2: Generate graph.json and pack.json with real SHA-256 hashes**
- [ ] **Step 3: Run tests to verify GREEN**
- [ ] **Step 4: Commit Task 2**

---

### Task 3: Client Core Mounting and Scenario Verification

**Files:**
- Create: `tests/tutorial-world-mounting.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write mounting test verifying ContentPackLoader mounts tutorial-world into Three.js scene**
- [ ] **Step 2: Run all release gates (Playwright, builds, boundary, audit, link check)**
- [ ] **Step 3: Commit Task 3**
