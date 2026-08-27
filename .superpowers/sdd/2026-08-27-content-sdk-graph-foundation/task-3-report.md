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

## Fix Round 1: Duplicate Roots and Complete Bounded Cycle Enumeration

Addressed all S1, S2, and Q1 review findings.

- Later duplicate roots now emit the exact literal `duplicate_root` diagnostic
  at `$.roots[i]`; the first occurrence remains authoritative.
- Quest `requires` validation now deterministically enumerates all simple
  quest-to-quest cycles rather than only DFS back edges. Search starts and
  adjacency are ordinally sorted, each search is anchored at its smallest ID,
  and signatures are sorted and deduplicated before emission.
- `MAX_CYCLE_SEARCH_STEPS = 100000` bounds path exploration and
  `MAX_CYCLE_DIAGNOSTICS = 1024` bounds cycle output. Exceeding either limit
  emits one deterministic invalid diagnostic and emits no partial cycle list.
- Plan commands no longer use the Playwright wildcard that selected zero tests
  on Windows. Tasks 3 through 5 now name every SDK test file that exists at
  that stage explicitly.

### TDD evidence

- S1 red: the focused graph command passed 10 tests and failed the new literal
  duplicate-root test because the graph incorrectly returned valid.
- S1 green: the focused graph command passed 11/11 after adding bounded root-ID
  tracking.
- S2 red: the focused graph command passed 11 tests and failed three new tests:
  the back-edge DFS omitted the overlapping `alpha`/`gamma` signature, an
  acyclic path explosion returned valid, and 1,025 cycles emitted 1,025
  diagnostics.
- S2 green: the focused graph command passed 14/14 after the bounded complete
  simple-cycle enumerator replaced back-edge-only collection.

### Fix verification

- Focused graph suite passed: 14 tests.
- Exact explicit SDK command passed 21/21:
  `npx playwright test tests/content-sdk-types.spec.ts tests/content-sdk-entity-validation.spec.ts tests/content-sdk-graph-validation.spec.ts`.
- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npx playwright test` passed: 43 tests, with the existing
  `NO_COLOR`/`FORCE_COLOR` environment warnings.
- `npm run check:public-boundary` passed with `[]`.
