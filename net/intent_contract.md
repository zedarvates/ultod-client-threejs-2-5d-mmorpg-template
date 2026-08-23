# Network Intent Contract (Three.js 2.5D Presentation)

Status: `decision`. This document maps the public `network-intent-v1` schema
from [ultimate-odycer-docs](https://github.com/zedarvates/ultimate-odycer-docs) to
the Three.js 2.5D client presentation shell.

## Authority boundary

The client NEVER validates rules, damage, rewards, inventory, movement speed, or
account permissions. It only constructs synthetic intent payloads and presents
authoritative state diffs received from the server.

## Intent mapping table

| Public family | Client intent method | Server validation required |
|---|---|---|
| `talk` | `request_dialogue(actor_id, target_id, choice_id)` | range, mute status, NPC availability |
| `interact` | `request_interact(actor_id, target_id)` | distance, ownership, cooldowns |
| `move` | `request_move(actor_id, target_position, yaw)` | max speed, collision, server physics |
| `session` | `request_realm_handoff(token)` | token validity, realm capacity, account rights |

## No live socket rule

While server compatibility remains not validated in [docs/SERVER-COMPATIBILITY.md](../docs/SERVER-COMPATIBILITY.md),
no live network socket implementation is published or executed. Intent construction
is exercised exclusively via synthetic fixture tests.
