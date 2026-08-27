# Asset Factory Sprite Atlas Design

## Goal

Add an opt-in, fail-closed `render-sprite-atlas` operation to Asset Factory and
a compatible Three.js sprite actor. The first proof renders one reviewed GLB
actor into eight directions for `idle`, `walk`, and `attack`, then loads it in
the public offline client without changing network authority.

This slice does not generate final game art, publish binaries, replace current
3D pipelines, or implement SFX. Generated files remain staging artifacts until
an artist accepts them and their redistribution terms are explicit.

## Existing contracts to preserve

- Asset Factory recipes use `uo.asset-recipe/v1`, explicit target lists,
  required gates, lineage, deterministic run manifests, and SHA-256 evidence.
- Blender execution may use the local socket or its existing headless fallback.
- The current Three.js capsules remain the explicit fallback when a sprite pack
  is absent, invalid, or still awaiting review.
- Gameplay and network authority are unchanged. The sprite actor consumes
  presentation state only.

## Asset Factory operation

The new adapter is:

```text
("sprite_atlas", "asset-factory-local", "render-sprite-atlas")
```

Its strict recipe parameters are:

- `source_glb`: relative path below the Asset Factory root.
- `actor_type`: `player`, `npc`, `creature`, or `effect`.
- `animations`: ordered objects containing a GLB clip name, public state name,
  frame count, and loop flag.
- `directions`: exactly the ordered eight-direction set `s`, `sw`, `w`, `nw`,
  `n`, `ne`, `e`, `se` for v1.
- `frame_size`: 192 or 256 pixels. The client renders the reference actor at
  approximately 96 pixels high.
- `fps`: integer from 6 through 24.
- `padding`: integer from 2 through 16 pixels.
- `profile`: `safe_warm` or `danger_chaotic`.
- `shadow`: `separate` or `none`; v1 defaults to `separate`.

The source must be a readable GLB with explicit provenance. Absolute paths,
path traversal, unknown fields, duplicate directions, empty clip names, and
undeclared outputs fail before Blender runs.

## Rendering

The worker imports one GLB into a clean Blender scene, measures its animated
bounds, and creates a fixed orthographic camera and normalized lighting rig.
For each direction and animation it samples deterministic timeline positions.
The actor rotates around a stable ground origin; the camera and framing do not
move between frames. Color management, transparent film, resolution, seed,
engine, and sampling settings are explicit.

Every rendered frame is RGBA PNG. The worker computes a common crop from the
union of all non-transparent actor bounds, then applies that crop consistently
to prevent visual jitter. The foot anchor is the projection of the source
origin onto the ground plane. A separate shadow layer uses the same crop and
anchor when requested.

Palette profiles affect lighting and color treatment only. They must not alter
geometry, animation timing, crop, anchor, or collision data.

## Packing and outputs

Packing is deterministic: animation declaration order, then direction order,
then frame index. V1 may create multiple pages when a single page would exceed
4096 by 4096 pixels. It never silently resize frames to fit.

Declared targets are:

- `sprite-pack.json`: runtime contract and per-file SHA-256 metadata.
- `sprite-atlas-N.png`: one or more transparent atlas pages.
- `sprite-shadow-atlas-N.png`: optional shadow pages.
- `sprite-contact-sheet.png`: human review sheet.
- `sprite-report.json`: gate measurements and failure reasons.

`sprite-pack.json` uses schema `uo.sprite-pack/v1`. It contains actor identity,
profile, source lineage, atlas pages, animations, directions, frame rectangles,
durations, loop flags, normalized foot anchors, optional shadow rectangles,
and review status. V1 exposes only a conservative actor collision footprint
derived from the source ground bounds; attack and hit boxes are explicitly
out of scope until authored data exists.

## Required gates

All gates are required and fail closed:

- `source-glb`: readable source, checksum, provenance, and declared lineage.
- `clip-contract`: every declared clip exists and yields the requested frames.
- `frame-decode`: every PNG is valid RGBA and non-empty.
- `alpha-fringe`: transparent borders do not retain visible RGB halos.
- `subject-occupancy`: the actor is neither clipped nor implausibly small.
- `stable-framing`: crop and foot anchor remain constant across the sequence.
- `direction-completeness`: every animation has all eight directions.
- `atlas-integrity`: rectangles are bounded, padded, non-overlapping, and map
  to declared files with matching checksums.
- `budget`: page dimensions, page count, frame count, and encoded bytes remain
  inside recipe budgets.
- `contact-sheet-review`: output is always `review_only` until an explicit
  artist decision records acceptance.
- `output-contract`: every declared artifact exists and no undeclared artifact
  is deliverable.

Automated gates may reject a pack, but passing them does not certify artistic
quality or redistribution rights.

## Three.js integration

The client adds a small `SpriteActor` presentation unit that loads
`uo.sprite-pack/v1`, verifies its structure, and maps movement vectors to eight
directions. It advances animation time using manifest durations and switches
states without modifying gameplay state. The bottom-center foot anchor remains
at the actor world position and the sprite always faces the isometric camera.

Load and validation failures are non-fatal: the caller logs a scoped warning
and keeps the current capsule. Sprite assets load after critical UI and first
render, preserving the existing deferred-scenery startup behavior.

## Tests and first proof

Asset Factory unit tests use synthetic RGBA fixtures and a fake Blender sender
to prove recipe rejection, deterministic ordering, stable crop, atlas bounds,
checksums, budget failure, and review-only status. One isolated Blender probe
uses a synthetic animated GLB if a compatible Blender executable is available;
otherwise it reports a named capability blocker rather than passing by mock.

Client tests validate schema rejection, direction mapping, animation timing,
foot anchoring, deferred loading, and capsule fallback. The existing build and
Playwright suite must still pass.

The first end-to-end candidate is accepted only when one source actor produces
all 24 animation-direction combinations, displays without visible foot jitter
at approximately 96 pixels high, and remains explicitly `review_only`. This is
a pipeline proof, not proof that the complete visual inventory exists.

## Implementation boundaries

Asset Factory changes are limited to a new worker, its tests, recipe dispatch,
and one example recipe. Existing Blender turntable, retopology, mesh, audio,
and delivery defaults remain unchanged. Client changes are limited to the
sprite contract/loader, actor presentation, synthetic fixture, and targeted
tests. SFX inventory and generation form the next separately validated slice.
