# Server Compatibility Gate

## Current decision

**Not validated.** This documentation repository does not claim compatibility with any historical or current Ultimate Odycer server.

## Required evidence before a network layer

- Canonical Zig server version and responsible owner
- Authentication and WebSocket / WebTransport realm-handoff contract
- Message identifiers, framing, serialization and version negotiation
- Server-authoritative rules for identity, movement, combat and inventory
- Transport security (WSS/TLS) and certificate expectations
- Synthetic loopback fixture with no production endpoint or credential
- Compatibility matrix naming the Three.js and server versions tested

## Fail-closed rule

Missing, ambiguous or outdated evidence means unsupported, not compatible. An isolated desktop browser execution does not prove production or cross-platform interoperability.
