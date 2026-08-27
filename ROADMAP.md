# Roadmap

| Gate | State | Exit condition |
|---|---|---|
| Documentation foundation | complete | Scope, security and publication boundaries are public |
| Web client architecture decision | complete | Minimal public feature boundary is approved (ADR-006) |
| Server WebSocket contract review | complete | Canonical protocol and authority rules are documented (SERVER-COMPATIBILITY.md) |
| Public extraction design | complete | Current main contains no private game lore or private binary assets |
| Binary asset redistribution | release-candidate-resolved / historical-releases-annotated | The `0.1.3` release candidate uses original procedural geometry and `v0.1.0`-`v0.1.2` carry historical notices |
| Minimal Three.js 2.5D shell | complete | Original isolated web shell runs without proprietary code |
| Local WebSocket connectivity fixture | complete | Synthetic loopback flow respects server authority |
| Template release | release-candidate | All local release gates and controller review must pass before the controller pushes, tags or publishes `v0.1.3` |

No waiting gate implies implementation or compatibility.
