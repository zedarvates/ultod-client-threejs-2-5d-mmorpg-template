# Task 3 Report: Content SDK Graph Validator

## Scope

Implemented the zero-runtime-dependency `validateContentGraph(value: unknown)`
SDK entry point. It validates graph envelopes, consumes `validateEntity` for
every nested entity, checks ID/root/reference closure, and rejects quest
prerequisite cycles with deterministic canonical signatures.

## TDD evidence

- Red cycle 1: `npx playwright test tests/content-sdk-graph-validation.spec.ts`
  failed 1/1 because `validateContentGraph` was absent (`Expected: "function"`,
  `Received: "undefined"`).
- Green cycle 1: after adding the minimal callable export, the valid closed
  realm/location graph passed 1/1.
- Red cycle 2: the focused command passed the valid graph and failed the nine
  newly introduced rejection, hostile-input, and bounded-iteration behaviors
  against the minimal always-valid stub (1 passed, 9 failed).
- Green cycle 2: after implementing graph validation, the focused command
  passed all 10 tests.

The literal tests cover a valid graph, duplicate IDs, a missing root, a
dangling target, a duplicate edge, two quest `requires` cycles under reversed
entity order, a malformed graph ID, an invalid nested entity, unknown and
throwing graph values, and an infinite collection length.

## Determinism and hostile-input boundary

- Diagnostics use fixed ordinal ordering by code, path, then message.
- Nested `validateEntity` paths are prefixed with their graph entity index.
- Quest adjacency and DFS roots are sorted ordinally. Each detected cycle is
  reduced to a sorted ID signature and emitted once.
- DFS is iterative to avoid recursion-depth failure on untrusted graphs.
- Graphs are bounded to 16,384 entities, 16,384 roots, 4,096 references per
  entity, and 65,536 total references. Throwing getters, invalid lengths, and
  oversized collections fail closed with a deterministic diagnostic.

## Verification

- Focused graph suite passed: 10 tests.
- All Content SDK tests passed: 17 tests.
- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed.
- `npx playwright test` passed: 39 tests.
- `git diff --check` passed.
- `npm run check:public-boundary` passed.

## Boundary and concerns

- The SDK adds no runtime dependency and introduces no private game names,
  paths, lore, or assets.
- Root Vite build retains the existing chunk-size warning for the 552.48 kB
  minified application chunk.
- Playwright child processes retain the environment warning that `NO_COLOR`
  is ignored while `FORCE_COLOR` is set.
