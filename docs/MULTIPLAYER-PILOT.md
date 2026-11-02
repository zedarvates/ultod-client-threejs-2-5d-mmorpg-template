# Two-client pilot: observations before acceptance

This is a domain adapter for the existing verified-mission workflow, not another
scheduler, network client or runtime attestation. The shipped network stub stays
inert. `ready_for_review` means that supplied observations agree; it never means
that the canonical Zig server or a browser has actually been tested.

## Current execution boundary (2 November 2026)

The inspected client main revision is `795d809a892a8c1fb5534ea21700c2d2b4f8ca0d`.
Its compatibility gate remains open. No accessible canonical server revision or
binary was found through the connected repository inventory. The name
`zig-server-v2` appears in `SERVER-COMPATIBILITY.md`, but the queried repository
was unavailable. This is an access observation, not proof that the project does
not exist. The real six-stage pilot is **blocked and not executed**.

## Required run

Use the existing feedback programme: #5 pins server/client compatibility; #6
proves Three.js round-trip; #7 replays it with Godot. Start the actual approved
server and two actual clients in an isolated test world. Use two distinct test
identities, not two windows authenticated as the same player. Capture structured
observations from the server and each client through reviewed adapters owned by
those projects. Do not implement a protocol from the old documentation tables.

| Criterion ID | Required domain observation |
| --- | --- |
| `connexion` | Server accepted A and B with distinct player and session IDs. |
| `spawn` | Each identity owns a distinct entity, created after its login. |
| `mouvement` | Server accepted one identified movement away from each entity's spawn position. |
| `pnj` | A receives the same identified NPC interaction result the server issued. |
| `synchronisation` | B sees A's accepted movement and A sees B's, with matching entity, movement ID, tick and position. |
| `reconnexion` | After A disconnects, the server and A observe the same resumed identity/entity, new session, tick and position; every captured post-resume server/A/B snapshot contains exactly one A and preserves both players' positions and B's session. |

The run collector orders events in an array; do not fabricate ordering from
unsynchronised wall clocks. IDs in this exchange are test aliases, not passwords,
JWTs or resume tokens. Positions must be finite. Limit traces to 4096 observations
and 1 MiB. This one bounded scenario is not a load, soak, anti-replay, rendering,
latency or packet-loss qualification.

## Explicit exchange format

`uo.multiplayer-pilot-trace/v1` is a new, separate, closed domain exchange format.
It does not add fields to a native server message or Botte receipt. Top-level
fields are exactly `schema`, `runId`, `mode`, `revisions`, `events`.
`mode` is `canonical_runtime`, `synthetic` or `blocked`; `revisions` has exact
40-character Git SHA pins `server` and `client`. Event fields are closed in
`scripts/check-multiplayer-pilot.mjs`. See `tests/multiplayer-pilot.test.mjs` for
**authored test data**, which is not runtime evidence. Keep recordings private;
the public test contains only invented aliases.

Run the checker with independently selected revision pins, not pins copied
automatically from the trace:

```sh
node scripts/check-multiplayer-pilot.mjs /private/run/trace.json \
  --server-revision ACTUAL_SERVER_SHA --client-revision ACTUAL_CLIENT_SHA
```

Exit codes: `0` = observations ready for review; `1` = inconsistent/invalid;
`2` = blocked, unavailable input or usage error. Output is the separate
`uo.multiplayer-pilot-check/v1` report with six stable criterion IDs and JSON
pointer `evidenceRefs`. `runtime_verified` is always `false`: JSON consistency
cannot authenticate an observation or prove its collector ran.

Wrap this real command with the existing Botte completion-proof runner and pin
its verifier file, input hash and output receipt in `botte.verified-mission/v1`.
Use a witness for each criterion and the neutral independent reviewer required
by that mission. The reviewer must inspect the actual server/client traces and
the named adapters/revisions. Never accept six self-reported success booleans,
promote a fixture to runtime proof, or mark an unexecuted check passed.

## Verify the domain adapter

```sh
npm run test:multiplayer-pilot
```

These tests exercise missing/mismatched peer state, duplicate reconnect entities,
same-player clients, local-only NPC results, revision mismatches and CLI exit
codes. Green adapter tests do not close the real compatibility gate.
