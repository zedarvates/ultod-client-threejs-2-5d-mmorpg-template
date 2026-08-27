# Roadmap

| Gate | State | Exit condition |
|---|---|---|
| Documentation foundation | complete | Scope, security and publication boundaries are public |
| Web client architecture decision | complete | Minimal public feature boundary is approved (ADR-006) |
| Server WebSocket contract review | complete | Canonical protocol and authority rules are documented (SERVER-COMPATIBILITY.md) |
| Public extraction design | complete | Current main contains no private game lore or private binary assets |
| Binary asset redistribution | release-ready-resolved / historical-releases-annotated | The `v0.1.3` release commit uses original procedural geometry and `v0.1.0`-`v0.1.2` carry historical notices |
| Minimal Three.js 2.5D shell | complete | Original isolated web shell runs without proprietary code |
| Local WebSocket connectivity fixture | complete | Synthetic loopback flow respects server authority |
| Template release | ready-to-publish | Local validation, fresh-clone verification and final review are complete; only push, tag, release and remote verification remain before `v0.1.3` is published |

No waiting gate implies implementation or compatibility.
