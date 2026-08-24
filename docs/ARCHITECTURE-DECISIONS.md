# Architecture Decisions

| Decision | State | Rule |
|---|---|---|
| ADR-001 | accepted | Keep this repository documentation-only until its publication gates are approved. |
| ADR-002 | accepted | The server remains authoritative for identity, movement, combat, inventory, progression and economy. |
| ADR-003 | accepted | Consume JSON registry snapshots only by pinned version and verified SHA-256. |
| ADR-004 | accepted | Three.js 2.5D web client uses dimetric orthographic camera and pointer/keyboard controls for local presentation. |
| ADR-006 | accepted | Future starter files must be original and created from the public extraction allowlist; proprietary client paths remain denied. |
| ADR-005 | accepted | 2.5D / isometric rendering must use modern WebGL/WebGPU canvas via Three.js with mobile-responsive viewport boundaries. |
| ADR-006 | accepted | The public starter uses Vite + TypeScript + Three.js as an ES-module build with no runtime framework dependency. |
| ADR-007 | accepted | Networking stays fail-closed: the shipped network layer contains no endpoint, credential or protocol claim until the server compatibility gate passes. |
| ADR-008 | accepted | Input abstraction covers keyboard, pointer and touch (virtual joystick) and maps to a single intent model consumed by gameplay systems. |

## Change policy

New decisions are appended rather than rewriting historical intent. A decision may move to superseded only when its replacement and evidence are documented.
