# Server Compatibility Gate

## Current decision

**Not validated.** This repository documents the observed protocol contract from
the canonical Zig server (`zig-server-v2`, private repository) as of 2026-08-24.
No live connection has been tested from this web client; no production endpoint
or credential is published here.

## Observed protocol contract

Two distinct framings coexist in the canonical server:

| Layer | Framing | Size | Notes |
|---|---|---|---|
| Game protocol (gateway → shard) | `u16 message_type (BE)` + `payload` | variable (2–65536 B) | Dispatched by `protocol.zig`; validated by sanitizer and size gates |
| Socket fast-path (`BinaryFrame`) | `magic u16 = 0x4F44 ("OD")` + `opcode u16` + `payload_len u16` + `checksum u16` + payload | 8 B header | XOR rolling checksum; used for movement deltas, combat actions, loot bids |

### Authentication flow

1. Client opens TCP (or WebSocket upgrade) to the gateway.
2. First packet carries a JWT bearer token (trimmed string).
3. Gateway validates via `jwt_auth.AuthMiddleware` → `player_id` extracted.
4. Gateway routes to best shard via load balancer.
5. Shard receives `authenticate_request` (opcode 13) with `[u32 len BE][u16 type][token]` framing.
6. Shard replies `authenticate_response` (opcode 14); first payload byte `1` = success.

### Realm handoff

- Contract: `shard_handoff_contract.zig` v1 — fixed envelope with identity, target, expiry window ≤ 300 s, hex resume token (64 chars).
- Extension encoding in realm list responses: `version(1) + host_len(1) + host + port(u16 BE) + tls_flag(1)`.
- TLS flag is advertised per endpoint; wildcard hosts are refused at encode time.

### Message families (MessageType enum, u16)

| Range | Family | Examples |
|---|---|---|
| 1–3 | Session | handshake, disconnect |
| 5–16 | Auth / clock | account_create, login, authenticate, refresh_token, time_sync |
| 20–29 | Characters | create/delete/select/list, world_spawn_select |
| 30–39 | Movement | position_update, movement_request, teleport, jump/roll/dodge/grapple/fly |
| 40–49 | Combat | attack, damage_taken, health_update, ability_use |
| 50–59 | Inventory | inventory_request/update, item_move/use |
| 60–69 | Chat / voice | chat_message, system_message, voice_chat |
| 70–79 | World interaction | interact, craft |
| 80–89 | Entities | entity_update/spawn/despawn/animation |
| 91–99 | Appearance / session resume | appearance_update/sync, session_resume*, morph_* |
| 100–119 | Arena / shop | arena_queue_*, shop_purchase_*, cosmetic_* |
| 120–129+ | VR | vr_pose_update, vr_optic_*, vr_grab/release_event |
| 130+ | NPC / misc | npc_action, player_despawn, notoriety_sync, terrain_update |

Full enum lives in `core/core_types.zig` (canonical server). This table is a
map, not a reimplementation; opcodes must be cross-checked against the pinned
server revision before any wire use.

### Server-authoritative boundaries

- Movement: client sends intent (`movement_request`), server validates speed, collision and physics.
- Combat: all damage resolution server-side; client only renders results.
- Inventory/economy: server-owned; client requests actions, never mutates locally.
- Spawn positions are never accepted from clients (`world_spawn_select` uses nonce-validated allowlist).

### WebSocket transport layer

A generic `WebSocketManager` exists in `services/websocket_manager.zig` with:
- default ping interval 30 s, pong timeout 10 s
- max message size 1 MiB
- room-based broadcast with exclusion support
- text/binary opcode support

This manager is separate from the game gateway path. Whether the public web
client connects through it or through a dedicated bridge is **undecided** and
requires an explicit architectural decision before implementation.

## Required evidence before this gate closes

1. Live loopback test: browser → gateway (or WS bridge) → shard, full auth + move + entity_update round-trip.
2. Named server revision tested (commit SHA) alongside named client build.
3. Version negotiation: how client and server agree on schema/framing version.
4. WSS/TLS certificate expectations documented for local dev and production.
5. Synthetic fixture replaying a recorded session without any production data.
6. Compatibility matrix listing exact Three.js version, Zig server version and browser engines tested.

## Fail-closed rule

Missing, ambiguous or outdated evidence means unsupported, not compatible.
An isolated desktop browser execution does not prove production or
cross-platform interoperability. The shipped network stub stays inert until
all six evidence items above exist.
