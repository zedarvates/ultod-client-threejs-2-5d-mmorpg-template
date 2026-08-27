# Tutorial World Content Pack

`examples/tutorial-world/` is the canonical public synthetic content-pack fixture.

It models a complete, closed 25-entity world spanning realm, region, biome, settlement, location, dungeon, route, factions, NPCs, quest, dialogues, items, creature species, monster variant, spawn table, encounter, vendor, and recipe.

## Structure

- `pack.json`: `uo.game-content-pack/v1` manifest declaring exact SHA-256 hashes, licenses, and provenance for all 26 artifacts.
- `graph.json`: `uo.game-content-graph/v1` resolved entity graph rooted at `realm.tutorial.haven`.
- `entities/`: 25 standalone `uo.game-content-entity/v1` JSON files.

## Validation

All files in this directory are verified against `@ultod/content-sdk` validators:

- `validateEntity` for each entity file in `entities/`.
- `validateContentGraph` for `graph.json`.
- `validateContentPackManifest`, `verifyContentPackIntegrity`, and `assessContentPackPublication` for `pack.json`.

## License

MIT License. All content is synthetic and contains zero private game lore.
