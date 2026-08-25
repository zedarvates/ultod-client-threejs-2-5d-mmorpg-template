# Changelog

All notable public changes are documented here.

## [0.1.1] - 2026-08-25

Playable-scenario correctness patch.

- The King now grants 50 gold on quest acceptance, making the 50g sword purchasable.
- Killing the Beast reveals Princess Elara so the final interaction is reachable.
- Player presentation is attached to the Three.js scene and visible at spawn.
- The demo house is offset from the spawn instead of covering the player and NPCs.
- The isometric camera follows the player throughout the trip to the Beast.
- Added five scenario regression tests; the complete suite now passes 10 tests.
- Verified the 1024x768 touch layout: joystick and interaction button visible, no console errors.

## [0.1.0] - 2026-08-25

First runnable public starter release: Three.js 2.5D shell with demo scenario,
editor bridges, loopback fixture, e2e tests, and live GitHub Pages deployment.

### Demo scenario

- "Rescue the Princess" quest line with 5 linear stages (King → Merchant → Beast → Princess).
- Merchant purchase flow (sword gated by gold), sword-gated combat, victory dialog.
- HTML UI layer: quest tracker panel, character dialog box with contextual actions, inventory strip.

### Editor bridges

- Architecture Editor bridge: renders HouseBlueprint JSON as instanced scene with AABB colliders.
- Creature Editor bridge: assembles XenoParts GLB previews from a XenoGenome JSON.
- Asset Factory provenance table for accepted generated props.

### Networking fixture

- Synthetic loopback mock server (127.0.0.1 only) implementing handshake/auth/authoritative movement.
- Pure protocol framing helpers in `src/net/protocol.ts`.
- Fail-closed rule enforced: unauthenticated traffic receives no gameplay response.

### Quality and deployment

- Playwright e2e suite (5 tests) covering boot, HUD, render liveness and full loopback flow.
- Secrets scan clean; fresh-clone install/build/test validated.
- Live demo deployed at GitHub Pages with mobile touch controls (joystick + interact button).

## Unreleased

### Minimal Three.js 2.5D presentation shell

- Added original `package.json`, `tsconfig.json`, `index.html`, and TypeScript presentation sources (`src/main.ts`, `src/player_presentation.ts`, `src/npc_presentation.ts`, `src/controls/isometric_controls.ts`).
- Added dimetric orthographic camera setup, lighting, grid, and point-and-click ground raycasting.
- Documented intent contract mapping to `network-intent-v1` and pinned templates rules.
- Added synthetic presentation test fixture.
- Documented public extraction design and file-level allowlist.

### Documentation foundation

- Defined public and excluded scope.
- Established security and publication gates.
- Recorded server-authoritative architecture decisions for 2.5D web client.
- Added versioned JSON registry consumption rules.
- Added contribution, support and versioning policies.
- Accepted web client architecture decision ADR-006 (Vite + TypeScript + Three.js).
- Accepted fail-closed networking rule ADR-007 and input abstraction rule ADR-008.

### Runtime

- Added original offline Three.js 2.5D starter shell: fixed-angle camera, unified keyboard/pointer/touch input, grid world sandbox and HUD overlay.
- Network layer ships as an inert fail-closed stub with no endpoint configured; no server compatibility is claimed.
- Added Architecture Editor bridge: loads a HouseBlueprint JSON and renders it as an instanced Three.js scene with simplified AABB colliders.
- Added demo blueprint (`maisonnette_standard`) and generated prop provenance table for Asset Factory outputs.
- Added Creature Editor bridge: assembles XenoParts GLB previews from a XenoGenome JSON.
- Added Playwright e2e suite (`npm run test:e2e`) covering shell boot, HUD fail-closed state and render-loop liveness.
- Documented observed canonical server protocol contract in SERVER-COMPATIBILITY.md; compatibility remains unvalidated pending live loopback evidence.
- Added synthetic loopback fixture: mock WebSocket server (loopback-only) implementing handshake/auth/authoritative movement, plus protocol framing helpers (`src/net/protocol.ts`) and two e2e tests verifying the full flow and fail-closed drop of unauthenticated traffic.
- Closed the public extraction design gate: file-level allowlist, explicit exclusion list and per-file extraction process are documented in PUBLIC-EXTRACTION-DESIGN.md.
- Pre-release validation passed: secrets scan clean, no private paths or LAN addresses, fresh-clone install + build + 5/5 e2e tests green. Template release awaits final human visual review.
- Added demo scenario "Rescue the Princess": quest state machine with 5 linear stages, King / Merchant / Beast / Princess NPCs with proximity interaction (E key), merchant purchase flow, sword-gated combat and victory dialog. HTML UI layer: quest tracker panel, character dialog box with action buttons, inventory strip.
