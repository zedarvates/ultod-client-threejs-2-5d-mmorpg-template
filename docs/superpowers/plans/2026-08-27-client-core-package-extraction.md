# Client Core Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the reusable Three.js 2.5D client engine components into `@ultod/threejs-client-core` at `packages/client-core` while preserving 100% of existing browser and scenario functionality.

**Architecture:** The core presentation, camera, input, network, UI, and content-pack mounting modules are packaged in `packages/client-core`. The root application consumes this workspace package alongside `@ultod/content-sdk`.

**Tech Stack:** TypeScript 5.6, Three.js 0.180, Playwright Test, Vite, npm workspaces

**Spec:** `docs/superpowers/specs/2026-08-27-client-core-package-extraction-design.md`

## Global Constraints

- Package name: `@ultod/threejs-client-core`, initial version `0.1.0`.
- `three` is listed as a peer dependency and dev dependency in the package.
- No private game lore, private paths, or binary assets in the package.
- All existing 108 Playwright tests must pass.
- Zero new runtime dependencies.

---

### Task 1: Package Scaffolding and Core Types

**Files:**
- Create: `packages/client-core/package.json`
- Create: `packages/client-core/tsconfig.json`
- Create: `packages/client-core/src/index.ts`
- Create: `tests/client-core-exports.spec.ts`
- Modify: `package.json` (add `check:client-core` script)

**Interfaces:**
- Produces: `@ultod/threejs-client-core` entry point and build targets.

- [ ] **Step 1: Write test for client-core package exports**
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Create package.json and tsconfig.json in packages/client-core**
- [ ] **Step 4: Verify test passes GREEN and typecheck passes**
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Migrate Camera, Controls, and Input Modules

**Files:**
- Create: `packages/client-core/src/camera/isometric-camera.ts`
- Create: `packages/client-core/src/camera/isometric-controls.ts`
- Create: `packages/client-core/src/input/types.ts`
- Create: `packages/client-core/src/input/keyboard-source.ts`
- Create: `packages/client-core/src/input/pointer-source.ts`
- Create: `packages/client-core/src/input/touch-joystick.ts`
- Create: `packages/client-core/src/input/input-manager.ts`
- Modify: `packages/client-core/src/index.ts`
- Create: `tests/client-core-input-camera.spec.ts`

**Interfaces:**
- Consumes: Three.js
- Produces: `IsometricCamera`, `IsometricControls`, `InputManager`, `KeyboardSource`, `PointerSource`, `TouchJoystick`

- [ ] **Step 1: Write failing test verifying camera & input exports from client-core**
- [ ] **Step 2: Migrate modules and export from packages/client-core**
- [ ] **Step 3: Run tests and verify GREEN**
- [ ] **Step 4: Commit Task 2**

---

### Task 3: Migrate Presentation, Bridges, and Sprite Actor Modules

**Files:**
- Create: `packages/client-core/src/presentation/sprite-pack.ts`
- Create: `packages/client-core/src/presentation/sprite-actor.ts`
- Create: `packages/client-core/src/presentation/procedural-creature-parts.ts`
- Create: `packages/client-core/src/presentation/procedural-template-props.ts`
- Create: `packages/client-core/src/presentation/prop-loader.ts`
- Create: `packages/client-core/src/presentation/blueprint-bridge.ts`
- Create: `packages/client-core/src/presentation/creature-bridge.ts`
- Create: `packages/client-core/src/presentation/city-map-bridge.ts`
- Create: `packages/client-core/src/presentation/player-presentation.ts`
- Create: `packages/client-core/src/presentation/npc-presentation.ts`
- Modify: `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes: Three.js, Camera & Input from Task 2
- Produces: `SpriteActor`, `loadTemplateProps`, `resolveCreaturePartUrl`, `PlayerPresentation`, `NpcPresentation`

- [ ] **Step 1: Write test verifying presentation exports from client-core**
- [ ] **Step 2: Migrate presentation modules and update exports**
- [ ] **Step 3: Run tests and verify GREEN**
- [ ] **Step 4: Commit Task 3**

---

### Task 4: Migrate Net, UI, and Content Mounting Modules

**Files:**
- Create: `packages/client-core/src/net/protocol.ts`
- Create: `packages/client-core/src/net/network-client.ts`
- Create: `packages/client-core/src/ui/hud-overlay.ts`
- Create: `packages/client-core/src/ui/dialog-box.ts`
- Create: `packages/client-core/src/content/content-pack-loader.ts`
- Modify: `packages/client-core/src/index.ts`
- Create: `tests/client-core-content-loader.spec.ts`

**Interfaces:**
- Consumes: `@ultod/content-sdk`, Three.js
- Produces: `NetworkClient`, `HudOverlay`, `DialogBox`, `ContentPackLoader`

- [ ] **Step 1: Write test for content pack loader and UI/Net exports**
- [ ] **Step 2: Migrate modules and implement ContentPackLoader**
- [ ] **Step 3: Run tests and verify GREEN**
- [ ] **Step 4: Commit Task 4**

---

### Task 5: Rewire Root App, Update Documentation & CI

**Files:**
- Modify: Root `src/` files to import from `@ultod/threejs-client-core`
- Create: `packages/client-core/README.md`
- Modify: `README.md`
- Modify: `.github/workflows/docs-validation.yml`

**Interfaces:**
- Integrates root app with `@ultod/threejs-client-core` and `@ultod/content-sdk`

- [ ] **Step 1: Update root app imports to consume @ultod/threejs-client-core**
- [ ] **Step 2: Update CI workflow to build and typecheck client-core**
- [ ] **Step 3: Run full verification suite (tests, builds, boundary, audit, link check, npm pack)**
- [ ] **Step 4: Commit Task 5**
