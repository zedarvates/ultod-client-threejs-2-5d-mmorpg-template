# Task 4 Report: Deterministic Normalization and Hash Manifest

## Scope

Implemented the zero-runtime-dependency `normalizeContentGraph`,
`serializeCanonicalGraph`, and asynchronous `sha256CanonicalGraph` SDK entry
points. Graph roots, entities, references, diagnostics, and recursively nested
object keys now have deterministic canonical ordering without mutating caller
data.

## TDD evidence

- Red cycle 1: `npx playwright test tests/content-sdk-normalization.spec.ts`
  passed 0 tests and failed 1 because `serializeCanonicalGraph` was absent
  (`Expected: "function"`, `Received: "undefined"`).
- Green cycle 1: after adding the minimal envelope serializer and Web Crypto
  hash, the literal empty graph JSON and SHA-256 test passed 1/1.
- Red cycle 2: after adding collection, nested-content, non-mutation, and
  unsupported-value cases, the focused command passed 1 test and failed 2.
  Roots remained reversed and `JSON.stringify` threw on `BigInt`.
- Green cycle 2: after implementing the canonical walker and semantic
  comparators, the focused command passed all 3 tests.

The empty public graph serializes exactly as:

```json
{"entities":[],"id":"graph.tutorial.empty","roots":[],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}
```

Its SHA-256 is exactly:

```text
936a997048458bea95f6c4f37085bc034e05692384bb04e9aab9244a23eadb81
```

## Canonical and unsupported-value policy

- Roots and entity IDs use ordinal sorting.
- References sort ordinally by `predicate`, then `target`, then optional
  `version` (missing version sorts as the empty string).
- Arrays named `diagnostics` sort independently by `code`, `path`, `message`,
  and finally their complete canonical representation.
- Other arrays preserve their authored order because unknown content arrays may
  be semantically ordered.
- Plain-object keys sort ordinally at every depth. Shared records are cloned,
  and caller-owned arrays and objects are never mutated.
- Unsupported leaves, non-finite numbers, non-plain objects, inaccessible
  properties, symbol-keyed records, and cycle back-edges normalize to `null`.
  This behavior is deterministic and non-throwing for unknown nested content.
- Hashing uses `TextEncoder` plus portable Web Crypto
  `crypto.subtle.digest("SHA-256", bytes)` and lower-case hexadecimal output.

## Verification

- Focused normalization suite passed: 3/3.
- Explicit Content SDK suite passed: 24/24:
  `npx playwright test tests/content-sdk-types.spec.ts tests/content-sdk-entity-validation.spec.ts tests/content-sdk-graph-validation.spec.ts tests/content-sdk-normalization.spec.ts`.
- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed.
- `npm run test:e2e` passed: 46/46.
- `npm run check:public-boundary` passed with `[]`.
- `git diff --check` passed.

## Boundary and concerns

- The SDK adds no runtime dependency and introduces no private game names,
  paths, lore, assets, or server details.
- Root Vite build retains the existing chunk-size warning for the 552.48 kB
  minified application chunk.
- Playwright child processes retain the environment warning that `NO_COLOR`
  is ignored while `FORCE_COLOR` is set.
