# Contributing

This repository accepts documentation improvements plus original starter code that respects the accepted architecture decisions.

## Current gate

Code must stay inside the Vite + TypeScript + Three.js boundary (ADR-006) and the fail-closed networking rule (ADR-007). No live WebSocket / WebTransport socket implementation may be published while server compatibility is not validated. Server compatibility remains unclaimed until its dedicated roadmap gate passes.

## Never include

- Existing proprietary client or server code
- Credentials, production endpoints or player data
- Protocol captures containing identities
- Commercial, administration and billing integrations
- Unreviewed third-party assets or branded content
- Claims of compatibility without named evidence

## Documentation contributions

Keep proof boundaries explicit, use synthetic examples, link primary evidence and distinguish planned, blocked, experimental and validated states.

Security-sensitive reports must use GitHub private vulnerability reporting rather than public issues.
