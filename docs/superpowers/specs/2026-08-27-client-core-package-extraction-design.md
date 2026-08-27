# Client Core Package Extraction Design

Status: `approved for implementation`
Date: `2026-08-27`
Applies to: `packages/client-core` (`@ultod/threejs-client-core`) and root presentation shell

## 1. Decision

Extract the reusable Three.js 2.5D client engine components into a dedicated workspace package: `@ultod/threejs-client-core` at `packages/client-core`.

The root demo shell continues to provide the runnable browser vertical slice and GitHub Pages demo by importing from `@ultod/threejs-client-core` and `@ultod/content-sdk`.

## 2. Goals

1. Isolate reusable isometric camera, input managers, sprite actors, procedural fallbacks, network clients, UI overlays, and content mounting logic.
2. Provide a clean TypeScript package with `three` as a peer dependency.
3. Keep the root demo shell functioning identically (all 108 existing tests remain green).
4. Maintain strict boundaries: zero private game lore or private binary assets in client-core.
5. Provide typed content-pack loading abstractions that connect `@ultod/content-sdk` with client rendering.

## 3. Package Architecture (`packages/client-core`)

```text
packages/client-core/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts
    camera/
      isometric-camera.ts
      isometric-controls.ts
    input/
      input-manager.ts
      keyboard-source.ts
      pointer-source.ts
      touch-joystick.ts
      types.ts
    presentation/
      sprite-actor.ts
      sprite-pack.ts
      procedural-creature-parts.ts
      procedural-template-props.ts
      prop-loader.ts
      blueprint-bridge.ts
      creature-bridge.ts
      city-map-bridge.ts
      player-presentation.ts
      npc-presentation.ts
    net/
      network-client.ts
      protocol.ts
    ui/
      hud-overlay.ts
      dialog-box.ts
    content/
      content-pack-loader.ts
```

## 4. Verification Gates

1. Package compiles cleanly: `npm --workspace @ultod/threejs-client-core run build`
2. Typecheck passes across all packages and root: `npm run check:client-core`, `npm run check:content-sdk`, root `tsc --noEmit`
3. Root Vite build succeeds.
4. All existing tests (108+) pass without regressions.
5. Public boundary check passes (`[]`).
6. Production audit has 0 vulnerabilities.
7. `npm pack --dry-run` validates standalone package contents.
