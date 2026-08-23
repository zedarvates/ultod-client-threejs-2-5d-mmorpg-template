# Original Shell Layout

Status: planned layout for the original Three.js 2.5D starter. These files are
isolated and original to this template repository.

```text
ultod-client-threejs-2-5d-mmorpg-template/
  package.json                       # project scripts and Three.js dependency
  tsconfig.json                      # TypeScript config
  index.html                         # viewport and canvas mount
  src/
    main.ts                          # isometric camera, lighting, render loop
    player_presentation.ts           # 2.5D player presentation mesh
    npc_presentation.ts              # 2.5D NPC representation and prompt
    controls/
      isometric_controls.ts          # ground-plane raycasting & input mapping
  net/
    intent_contract.md               # documentation map to network-intent-v1
  content/
    pinned_templates.md              # version + SHA-256 only
  tests/
    synthetic_fixtures/              # player_demo_* / npc_demo_*
```

Local canvas rendering and input prediction provide immediate feedback in the
browser. They must not award loot, apply damage, change inventory, or accept
a speed hack.

No `net/*.ts` WebSocket / WebTransport socket implementation is allowed while
server compatibility is not validated. See [SERVER-COMPATIBILITY.md](SERVER-COMPATIBILITY.md)
and the public [network-intent-v1](https://github.com/zedarvates/ultimate-odycer-docs/blob/main/schemas/network-intent-v1.schema.json) fixture.
