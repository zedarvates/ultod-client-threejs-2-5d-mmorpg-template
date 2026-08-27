# @ultod/threejs-client-core

`@ultod/threejs-client-core` provides reusable presentation and controller
primitives for Three.js 2.5D isometric MMORPG clients.

Version **0.1.0** includes:

- **Camera & Controls**: `IsometricCamera` (fixed-angle following with aspect maintenance) and `IsometricControls` (ground-plane raycasting step computation).
- **Input Management**: Unified `InputManager` aggregating keyboard, pointer, and virtual touch joystick into normalized frame `MoveIntent` samples.
- **Presentation & Bridges**: `PlayerPresentation`, `NPCPresentation`, procedural prop and creature genome assemblers (`buildFromBlueprint`, `buildCreature`, `loadTemplateProps`).
- **Network Framing**: Pure message encoding/decoding (`MSG`, `encodeMessage`, `decodeMessage`, `encodeMovement`, `decodePositionUpdate`) and fail-closed `NetworkClient` stub.
- **UI Controllers**: `HudOverlay` and `DialogBox` interaction controllers.
- **Content Mounting**: `ContentPackLoader` for mounting validated `GameContentGraph` entities into Three.js scene graphs.

## Installation & Build

```bash
npm install
npm --workspace @ultod/threejs-client-core run build
```

## Usage

```ts
import * as THREE from 'three';
import {
  IsometricCamera,
  InputManager,
  ContentPackLoader,
} from '@ultod/threejs-client-core';

const canvas = document.querySelector('canvas')!;
const camera = new IsometricCamera(canvas);
const input = new InputManager();
const loader = new ContentPackLoader();
```

## Boundary and License

This package is MIT licensed and contains zero private game lore or binary assets.
