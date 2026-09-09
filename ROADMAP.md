# Roadmap

| Gate | State | Exit condition |
|---|---|---|
| Documentation foundation | complete | Scope, security and publication boundaries are public |
| Web client architecture decision | complete | Minimal public feature boundary is approved (ADR-006) |
| Server WebSocket contract review | complete | Canonical protocol and authority rules are documented (SERVER-COMPATIBILITY.md) |
| Public extraction design | complete | Current main contains no private game lore or private binary assets |
| Binary asset redistribution | current-release-resolved / historical-releases-annotated | The `v0.1.3` release uses original procedural geometry and `v0.1.0`-`v0.1.2` carry historical notices |
| Minimal Three.js 2.5D shell | complete | Original isolated web shell runs without proprietary code |
| Local WebSocket connectivity fixture | complete | Synthetic loopback flow respects server authority |
| Deterministic game-site generator V1 | complete | Strict manifest validation, byte-identical output, transactional rollback and browser accessibility/no-network proof pass |
| Canonical Zig E2E proof | waiting / tracked | `ultimate-odycer-feedback#5` freezes the server baseline and `#6` proves auth → handoff → movement → authoritative entity update against that exact revision |
| Paranoid protocol security | waiting / tracked | `ultimate-odycer-feedback#8` supplies negative fixtures, fuzzing, anti-replay and anti-duplication gates |
| Crash-safe persistence evidence | server-side / tracked | `ultimate-odycer-feedback#9` proves persistence and restore invariants before any production compatibility claim |
| Template release | complete | `v0.1.3` is published and Pages verification is complete |

## P0 interoperability program

This public MIT starter is the first protocol test client, not the owner of gameplay rules. The active proof sequence is:

1. `ultimate-odycer-feedback#5` — pin the exact private canonical Zig server revision and compatibility matrix.
2. `ultimate-odycer-feedback#6` — prove the real Zig ↔ Three.js authoritative round trip.
3. `ultimate-odycer-feedback#7` — replay the same canonical fixture from Godot Classic and Godot VR.
4. `ultimate-odycer-feedback#8` — keep malformed, replayed, forged and adversarial input fail-closed.
5. `ultimate-odycer-feedback#9` — prove critical-state crash and restore invariants.

## License boundary

This repository contains only material explicitly released under its public license and compatible third-party material. Private Ultimate Odycer server code, proprietary gameplay implementation, production configuration, credentials, private lore/assets and commercial components remain outside this repository and are commercial/proprietary, all rights reserved unless their own explicit license says otherwise. Access to a private repository is not permission to copy its code into this public starter. Any extraction from private material requires file-level provenance and license review and should prefer independently written adapters against the approved public contract.

No waiting gate implies implementation or compatibility.
