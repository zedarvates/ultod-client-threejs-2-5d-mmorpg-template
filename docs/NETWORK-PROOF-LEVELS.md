# Network proof levels

This repository distinguishes test evidence from real server compatibility. A passing mock or local fixture MUST NOT be reported as compatibility with the private canonical Zig server.

## Levels

| Level | Meaning | May claim Zig compatibility? |
|---|---|---|
| `DOCUMENTED` | Contract or intent is described in public documentation only. | No |
| `SYNTHETIC_FIXTURE_ONLY` | Client behavior passes against an isolated synthetic loopback fixture. | No |
| `PINNED_SERVER_AVAILABLE` | An exact private canonical Zig repository revision, Zig toolchain version, protocol revision and build mode are recorded. | No, not until exercised |
| `REAL_SERVER_E2E` | The named client revision passes the canonical interoperability scenario against the pinned Zig revision. | Yes, only for the tested scope |
| `ADVERSARIAL_E2E` | Negative, replay, malformed-frame and authority-abuse cases pass against the pinned Zig revision. | Yes, with the tested security scope named |
| `RELEASE_PROVEN` | The exact released client/server revisions repeat the required E2E and release gates. | Yes, for those exact revisions |

## Fake-green rule

A test is `FAKE-GREEN` when it passes but its result is presented as evidence for a system it did not exercise. Examples include:

- a mock WebSocket server presented as proof of the canonical Zig server;
- a client unit test presented as proof of server-side authority;
- documentation or JSON schemas presented as runtime compatibility;
- a skipped or unreachable integration test reported as passing;
- a synthetic credential presented as JWT validation.

CI, release notes and human reports must state the proof level explicitly when network compatibility is discussed.

## Current Three.js status

The tests in `tests/loopback.spec.ts` and `tests/mock-loopback-server.mjs` are `SYNTHETIC_FIXTURE_ONLY`. They intentionally test framing, fail-closed authentication ordering, bounded frames, finite movement coordinates, speed rejection and authoritative broadcast semantics. They do not test TLS/WSS, JWT validation, realm handoff, reconnect/session resume, persistence, production rate limits or the private Zig runtime.

The promotion path is tracked in the Ultimate Odycer interoperability P0 program. The client must not be promoted to `REAL_SERVER_E2E` until the canonical private Zig repository and exact baseline SHA are available and recorded.

## Licensing boundary

This public client/template remains governed by its explicit repository license. The private canonical Zig server, proprietary gameplay implementation, production configuration, private assets/lore and commercial components remain outside this repository and are proprietary/commercial, all rights reserved unless their own explicit license states otherwise. No synthetic fixture may copy private server implementation code merely to make a test pass.
