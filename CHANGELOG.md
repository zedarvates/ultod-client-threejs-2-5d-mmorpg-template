# Changelog

All notable public changes will be documented here once versioned releases begin.

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
