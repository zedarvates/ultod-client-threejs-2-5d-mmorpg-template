# Asset Factory Sprite Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed Asset Factory sprite-atlas worker and a Three.js `SpriteActor` proof with deterministic eight-direction animation, review-only outputs, and capsule fallback.

**Architecture:** A focused Python worker validates recipes, asks the existing Blender transport for deterministic RGBA frames, normalizes and packs those frames with Pillow, and emits `uo.sprite-pack/v1` plus auditable gates. A separate TypeScript loader validates that runtime contract and presents it without changing gameplay or network authority.

**Tech Stack:** Python 3, pytest, Pillow, existing Asset Factory Blender transport; TypeScript 5.6, Three.js 0.180, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-08-27-asset-factory-sprite-atlas-design.md`

## Global Constraints

- Asset Factory root: `F:/_Serv ULtimate Od/Development/Tools/asset-factory`.
- Client root: `C:/ultod-client-threejs-2-5d-mmorpg-template`.
- The operation is opt-in and must not change existing Blender, retopology, mesh, audio, or delivery defaults.
- V1 directions are exactly `s`, `sw`, `w`, `nw`, `n`, `ne`, `e`, `se`.
- V1 frame sizes are exactly 192 or 256 pixels; atlas pages never exceed 4096 by 4096 pixels.
- Outputs remain `review_only`; passing automated gates does not grant redistribution rights.
- Missing or invalid runtime packs preserve the existing capsule presentation.
- Use `rtk` for every shell command and stage only named files.

---

## File structure

Asset Factory:

- Create `asset_factory/sprite_atlas_worker.py`: recipe validation, frame normalization, deterministic packing, gates, pack/report emission, and Blender orchestration.
- Create `asset_factory/test_sprite_atlas_worker.py`: contract, packing, gate, dispatch, and fake-render tests.
- Modify `asset_factory/recipe_job.py`: register and dispatch only the new adapter.
- Create `examples/sprite_atlas_actor.example.json`: review-only reference recipe.

Client:

- Create `src/render/sprite-pack.ts`: strict runtime schema parser and direction mapping.
- Create `src/render/sprite-actor.ts`: texture loading, frame selection, anchoring, state updates, and disposal.
- Create `tests/sprite-actor.spec.ts`: parser, direction, timing, and fallback-facing unit tests.
- Modify `src/player_presentation.ts`: optional sprite attachment while retaining the capsule.
- Modify `src/main.ts`: deferred loading of the proof pack after first render.
- Create `public/sprites/PROVENANCE.md`: staging/review boundary; no generated binary is added until accepted.

### Task 1: Strict sprite recipe contract and deterministic packer

**Files:**
- Create: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/sprite_atlas_worker.py`
- Create: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/test_sprite_atlas_worker.py`

**Interfaces:**
- Produces: `ADAPTER`, `DIRECTIONS`, `REQUIRED_GATES`, `validate_recipe_contract(recipe)`, `normalize_frames(frames, frame_size)`, and `pack_frames(frames, frame_size, padding, max_page_size=4096)`.
- `normalize_frames` returns `(normalized_frames, anchor)` where every frame is RGBA `PIL.Image.Image` of identical size and `anchor` is normalized `[x, y]`.
- `pack_frames` returns ordered page images and frame records containing `page`, `x`, `y`, `w`, `h`.

- [ ] **Step 1: Write failing recipe-contract tests**

```python
def test_contract_accepts_exact_v1_shape():
    assert validate_recipe_contract(_recipe())["pipeline"]["operation"] == "render-sprite-atlas"

@pytest.mark.parametrize("mutation", ["path_escape", "missing_direction", "duplicate_direction", "unknown_field", "bad_frame_size"])
def test_contract_rejects_unsafe_or_ambiguous_recipe(mutation):
    recipe = _mutated_recipe(mutation)
    with pytest.raises(ContractError):
        validate_recipe_contract(recipe)
```

- [ ] **Step 2: Run the contract tests and confirm the worker is absent**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py -k contract`

Expected: collection fails because `asset_factory.sprite_atlas_worker` does not exist.

- [ ] **Step 3: Implement the strict contract**

```python
ADAPTER = ("sprite_atlas", "asset-factory-local", "render-sprite-atlas")
DIRECTIONS = ("s", "sw", "w", "nw", "n", "ne", "e", "se")
REQUIRED_GATES = [
    "source-glb", "clip-contract", "frame-decode", "alpha-fringe",
    "subject-occupancy", "stable-framing", "direction-completeness",
    "atlas-integrity", "budget", "contact-sheet-review", "output-contract",
]

def validate_recipe_contract(recipe: dict[str, Any]) -> dict[str, Any]:
    parameters = recipe["pipeline"]["parameters"]
    expected = {"source_glb", "actor_type", "animations", "directions", "frame_size", "fps", "padding", "profile", "shadow"}
    if set(parameters) != expected:
        raise ContractError("render-sprite-atlas exige ses neuf parametres v1 exacts")
    # Validate relative .glb path, enums, exact direction order, unique animation
    # public names and clip names, frame_count >= 1, 6 <= fps <= 24,
    # frame_size in {192, 256}, 2 <= padding <= 16, and exact targets/gates.
    return recipe
```

Implement the validation explicitly; do not silently default missing recipe fields.

- [ ] **Step 4: Add synthetic normalization and packing tests**

```python
def test_normalization_uses_one_union_crop_and_stable_anchor():
    frames = _moving_actor_frames()
    normalized, anchor = normalize_frames(frames, 192)
    assert {image.size for image in normalized.values()} == {(192, 192)}
    assert anchor == pytest.approx([0.5, 1.0], abs=0.01)

def test_packer_is_ordered_padded_and_non_overlapping():
    pages, records = pack_frames(_opaque_frames(24), 192, 4)
    assert [record["key"] for record in records] == _expected_frame_keys()
    assert all(page.width <= 4096 and page.height <= 4096 for page in pages)
    _assert_rectangles_do_not_overlap(records, padding=4)
```

- [ ] **Step 5: Implement union-crop normalization and shelf packing**

Use `Image.getbbox()` over alpha, reject empty frames, compute one union box for all frames, preserve RGBA, and place frames in declaration order with explicit padding. Create a new page instead of resizing when the next shelf exceeds 4096.

- [ ] **Step 6: Run and commit Task 1**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py -k "contract or normalization or packer"`

Expected: PASS.

```powershell
rtk git add -- asset_factory/sprite_atlas_worker.py asset_factory/test_sprite_atlas_worker.py
rtk git commit -m "feat(asset-factory): add sprite atlas contract and packer"
```

### Task 2: Blender frame rendering and fail-closed gates

**Files:**
- Modify: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/sprite_atlas_worker.py`
- Modify: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/test_sprite_atlas_worker.py`

**Interfaces:**
- Consumes: `validate_recipe_contract`, `normalize_frames`, and `pack_frames` from Task 1; existing `blender_ops.send` and `blender_ops.find_blender_path`.
- Produces: `render_sprite_frames(cfg, recipe, sender=blender_ops.send)` and `build_sprite_pack(cfg, recipe, sender=blender_ops.send)` returning the standard `run_id`, `artifact_paths`, `artifact_specs`, `pack`, and `report` dictionary.

- [ ] **Step 1: Write fake-Blender and gate tests**

```python
def test_build_emits_review_only_pack_checksums_and_all_directions(tmp_path):
    result = build_sprite_pack(_cfg(tmp_path), _recipe(), sender=_fake_rgba_sender)
    assert result["pack"]["schema"] == "uo.sprite-pack/v1"
    assert result["pack"]["delivery_status"] == "review_only"
    assert result["pack"]["directions"] == list(DIRECTIONS)
    assert all(len(item["sha256"]) == 64 for item in result["pack"]["files"])

def test_empty_or_clipped_frame_fails_without_delivery(tmp_path):
    result = build_sprite_pack(_cfg(tmp_path), _recipe(), sender=_empty_frame_sender)
    assert result["report"]["status"] == "review"
    assert result["report"]["gates"]["frame-decode"]["status"] == "fail"
```

- [ ] **Step 2: Run tests and verify the missing function failure**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py -k "build_emits or empty_or_clipped"`

Expected: FAIL because `build_sprite_pack` is not defined.

- [ ] **Step 3: Implement the isolated Blender script**

The script must reset to a factory scene, import the declared GLB, verify every clip, compute animated bounds, create an orthographic camera, set transparent film and explicit color management, rotate the actor through the eight directions, sample deterministic frame positions, and write named RGBA PNG files below the run staging directory. Return only an `AF_RESULT` JSON marker listing logical frame keys and paths.

```python
def render_sprite_frames(cfg, recipe, sender=blender_ops.send):
    script = _build_blender_script(recipe, staging_dir)
    raw = sender("execute_code", {"code": script}, host, port)
    return _parse_blender_result(raw, staging_dir, expected_keys)
```

Reject missing markers, unexpected keys, files outside staging, non-PNG paths, or missing files.

- [ ] **Step 4: Implement pack/report/contact-sheet emission and gates**

Emit every declared artifact, compute SHA-256 and bytes after writing, and calculate all eleven gates. `contact-sheet-review` always records `review` and `requires_artist_review: true`; therefore the pack stays `review_only` even when every mechanical gate passes.

- [ ] **Step 5: Add deterministic-repeat and budget tests**

```python
def test_same_frames_produce_identical_atlas_and_manifest_payload(tmp_path):
    first = build_sprite_pack(_cfg(tmp_path / "a"), _recipe(), sender=_fake_rgba_sender)
    second = build_sprite_pack(_cfg(tmp_path / "b"), _recipe(), sender=_fake_rgba_sender)
    assert _artifact_hash(first, "sprite-atlas-0") == _artifact_hash(second, "sprite-atlas-0")
    assert _stable_pack_payload(first["pack"]) == _stable_pack_payload(second["pack"])

def test_budget_failure_is_reported_not_delivered(tmp_path):
    recipe = _recipe(max_encoded_bytes=32)
    result = build_sprite_pack(_cfg(tmp_path), recipe, sender=_fake_rgba_sender)
    assert result["report"]["gates"]["budget"]["status"] == "fail"
```

- [ ] **Step 6: Run and commit Task 2**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py`

Expected: PASS.

```powershell
rtk git add -- asset_factory/sprite_atlas_worker.py asset_factory/test_sprite_atlas_worker.py
rtk git commit -m "feat(asset-factory): render and validate sprite atlas packs"
```

### Task 3: Recipe dispatch and example recipe

**Files:**
- Modify: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/recipe_job.py`
- Modify: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/test_sprite_atlas_worker.py`
- Create: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/examples/sprite_atlas_actor.example.json`

**Interfaces:**
- Consumes: `SPRITE_ATLAS_ADAPTER`, `validate_sprite_atlas_recipe`, and `build_sprite_pack`.
- Produces: standard `run_recipe(cfg, recipe, deliver=False)` support for `kind=sprite_atlas`, with `artifact_inputs` refused in v1.

- [ ] **Step 1: Write failing dispatch tests**

```python
def test_recipe_job_dispatches_sprite_pack_without_delivery(tmp_path, monkeypatch):
    manifest = run_recipe(_cfg(tmp_path), _recipe(), deliver=False, runner=_fake_pack_runner)
    assert manifest["status"] == "review"
    assert manifest["publishable"] is False
    assert manifest["run_report"]["delivered"] == []

def test_sprite_adapter_refuses_artifact_inputs_before_render(tmp_path):
    with pytest.raises(ContractError, match="artifact_inputs"):
        run_recipe(_cfg(tmp_path), _recipe(), deliver=False, artifact_inputs=[{}])
```

- [ ] **Step 2: Run tests and verify unsupported adapter failure**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py -k "dispatches or refuses_artifact"`

Expected: FAIL with unsupported adapter.

- [ ] **Step 3: Register strict dispatch**

Import the adapter/validator, add the adapter to `SUPPORTED_ADAPTERS`, call its validator from the existing validation branch, and add one `run_recipe` branch mirroring `prepare-multiview` without modifying other branches.

- [ ] **Step 4: Add the exact review recipe**

The example declares one relative synthetic GLB, `idle`, `walk`, and `attack`, all eight directions, 192 px frames, 12 fps, 4 px padding, `safe_warm`, separate shadow, the exact required gates, budgets, and `review_only` targets.

- [ ] **Step 5: Run scoped regression and commit Task 3**

Run: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py asset_factory/test_recipe_job.py`

Expected: PASS.

```powershell
rtk git add -- asset_factory/recipe_job.py asset_factory/test_sprite_atlas_worker.py examples/sprite_atlas_actor.example.json
rtk git commit -m "feat(asset-factory): dispatch sprite atlas recipes"
```

### Task 4: Three.js sprite-pack parser and actor

**Files:**
- Create: `src/render/sprite-pack.ts`
- Create: `src/render/sprite-actor.ts`
- Create: `tests/sprite-actor.spec.ts`

**Interfaces:**
- Produces: `parseSpritePack(value: unknown): SpritePack`, `directionForVector(x: number, z: number, fallback: SpriteDirection): SpriteDirection`, and class `SpriteActor` with `load`, `setState`, `update`, `setVisible`, and `dispose`.
- `SpriteActor.load(packUrl, scene, textureLoader?)` resolves to a ready actor or rejects without mutating the scene.

- [ ] **Step 1: Write failing parser and direction tests**

```typescript
test("parser rejects unreviewed structural corruption", () => {
  expect(() => parseSpritePack({ schema: "uo.sprite-pack/v1", directions: ["s"] })).toThrow();
});

test("movement maps deterministically to eight directions", () => {
  expect(directionForVector(0, 1, "s")).toBe("s");
  expect(directionForVector(1, -1, "s")).toBe("ne");
  expect(directionForVector(0, 0, "w")).toBe("w");
});
```

- [ ] **Step 2: Run tests and verify missing modules**

Run: `rtk npx playwright test tests/sprite-actor.spec.ts`

Expected: TypeScript import failure.

- [ ] **Step 3: Implement strict parser and direction mapping**

Define explicit interfaces for pages, animations, and frames. Validate schema, exact direction order, finite positive durations, page indices, bounded integer rectangles, normalized anchors, unique animation names, and file paths that remain relative to the pack URL.

```typescript
export function directionForVector(x: number, z: number, fallback: SpriteDirection): SpriteDirection {
  if (Math.hypot(x, z) < 1e-6) return fallback;
  const octant = Math.round(Math.atan2(x, z) / (Math.PI / 4));
  return DIRECTIONS[(octant + 8) % 8]!;
}
```

- [ ] **Step 4: Write failing timing and anchor tests**

```typescript
test("actor advances manifest frames and preserves the foot anchor", async () => {
  const actor = await SpriteActor.fromTextures(validPack, fakeTextures());
  actor.setState("walk", "e");
  actor.update(0.2);
  expect(actor.currentFrameIndex()).toBe(1);
  expect(actor.sprite.center.y).toBeCloseTo(0);
});
```

- [ ] **Step 5: Implement `SpriteActor`**

Use one `THREE.Sprite`, update texture repeat/offset from the active rectangle, derive `Sprite.center` from the normalized foot anchor, preserve world position, and dispose only textures/material created by the actor. Loading errors must remove any partial object before rejection.

- [ ] **Step 6: Run and commit Task 4**

Run: `rtk npx playwright test tests/sprite-actor.spec.ts`

Expected: PASS.

```powershell
rtk git add -- src/render/sprite-pack.ts src/render/sprite-actor.ts tests/sprite-actor.spec.ts
rtk git commit -m "feat: add deterministic sprite actor runtime"
```

### Task 5: Player fallback integration and vertical proof

**Files:**
- Modify: `src/player_presentation.ts`
- Modify: `src/main.ts`
- Modify: `tests/sprite-actor.spec.ts`
- Create: `public/sprites/PROVENANCE.md`

**Interfaces:**
- Consumes: `SpriteActor` from Task 4.
- Produces: `PlayerPresentation.attachSprite(actor)`, `setMovementState(x, z, moving, running)`, and unchanged public `mesh.position` authority for existing callers.

- [ ] **Step 1: Write failing capsule-fallback tests**

```typescript
test("player keeps capsule visible when sprite loading fails", async () => {
  const scene = new THREE.Scene();
  const player = new PlayerPresentation(scene);
  await expect(player.tryAttachSprite(() => Promise.reject(new Error("invalid pack")))).resolves.toBe(false);
  expect(player.mesh.visible).toBe(true);
});

test("accepted sprite hides only the capsule geometry", async () => {
  const player = new PlayerPresentation(new THREE.Scene());
  expect(await player.tryAttachSprite(() => Promise.resolve(fakeActor()))).toBe(true);
  expect(player.mesh.visible).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify missing integration methods**

Run: `rtk npx playwright test tests/sprite-actor.spec.ts`

Expected: FAIL because `tryAttachSprite` is absent.

- [ ] **Step 3: Implement presentation-only attachment**

Keep `player.mesh` as the canonical position object. Parent the sprite actor under a sibling/group that copies the mesh position each frame, hide the capsule only after successful actor creation, and restore it if the actor is detached or fails validation.

- [ ] **Step 4: Add deferred proof loading in `main.ts`**

Extend the existing delayed `loadShowcaseContent()` path to attempt
`sprites/reference-player/sprite-pack.json`. Do not add a binary fixture until
Asset Factory has generated it and the artist has accepted its provenance.
Treat HTTP failure, JSON failure, and pack rejection as one scoped warning and
leave the capsule visible. Pass movement state from the existing computed
movement delta; do not alter controls, quest state, or networking.

- [ ] **Step 5: Document the provenance boundary**

`public/sprites/PROVENANCE.md` must state that generated sprite packs require an
accepted Asset Factory run, SHA-256 manifest, artist review, and explicit
redistribution terms before copying into the public client.

- [ ] **Step 6: Run client gates**

Run: `rtk npm run build`

Expected: TypeScript and Vite build PASS.

Run: `rtk npx playwright test tests/sprite-actor.spec.ts tests/scenario.spec.ts tests/shell.spec.ts`

Expected: PASS; the scenario remains playable with no sprite binary present.

- [ ] **Step 7: Commit Task 5**

```powershell
rtk git add -- src/player_presentation.ts src/main.ts tests/sprite-actor.spec.ts public/sprites/PROVENANCE.md
rtk git commit -m "feat: add fail-closed player sprite integration"
```

### Task 6: Isolated real Blender proof and evidence report

**Files:**
- Modify only if a defect is found: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/sprite_atlas_worker.py`
- Modify only if a regression test is needed: `F:/_Serv ULtimate Od/Development/Tools/asset-factory/asset_factory/test_sprite_atlas_worker.py`
- Generated staging outputs: below Asset Factory `output/`, never copied automatically to the public client.

**Interfaces:**
- Consumes: example recipe and `run_recipe` support from Tasks 1-3.
- Produces: named proof result with Blender capability, run ID, report status, gates, artifact hashes, frame count, and explicit review blocker.

- [ ] **Step 1: Run the complete scoped test gates**

Run from Asset Factory: `rtk pytest -q asset_factory/test_sprite_atlas_worker.py asset_factory/test_recipe_job.py`

Run from client: `rtk npm run build`

Run from client: `rtk npm run test:e2e`

Expected: all scoped suites PASS; unrelated failures are reported separately.

- [ ] **Step 2: Probe Blender without starting or stopping services**

Run a read-only Python call to `blender_ops.find_blender_path()` and record the
exact executable/version. If unavailable, stop the real-render gate with
`blender_executable_missing`; unit fixtures do not substitute for this proof.

- [ ] **Step 3: Run one review-only reference recipe**

Use a synthetic or explicitly reviewed local animated GLB. Run with
`deliver=False`. Do not use paid providers, copy outputs into the client, or
publish anything.

- [ ] **Step 4: Inspect evidence**

Confirm 3 animations x 8 directions, stable 192 px frames, constant foot
anchor, bounded atlas pages, matching hashes, and `delivery_status=review_only`.
Open the contact sheet for human review. Do not call the art accepted yourself.

- [ ] **Step 5: Commit only defect fixes with their regression tests**

```powershell
rtk git add -- asset_factory/sprite_atlas_worker.py asset_factory/test_sprite_atlas_worker.py
rtk git commit -m "fix(asset-factory): harden sprite atlas proof"
```

Skip this commit when no files changed. Report the real proof separately from
the synthetic unit coverage and leave SFX as the next planned slice.
