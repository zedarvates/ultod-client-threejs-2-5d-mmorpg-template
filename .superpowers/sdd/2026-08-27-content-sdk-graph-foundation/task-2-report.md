# Task 2 Report: Content SDK Entity Envelope Validator

## Scope

Implemented the zero-dependency `validateEntity(value: unknown)` SDK entry
point, including public ID and semantic-version patterns. The validator is
non-throwing for malformed input and returns deterministically sorted literal
diagnostics.

## TDD evidence

- Red: `npx playwright test tests/content-sdk-entity-validation.spec.ts`
  failed because `../packages/content-sdk/src` did not export `validateEntity`.
- Green: the same focused command passed all 3 tests after the minimal
  implementation.

The tests assert exact diagnostics for malformed ID, unsupported kind, invalid
semantic version, invalid authority, duplicate references, and missing license
ID, plus valid realm and malformed-input behavior.

## Verification

- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed.
- `npx playwright test` passed: 27 tests.
- `git diff --check` passed.

## Boundary and concerns

- The SDK adds no runtime dependency and no private game names or assets.
- Root Vite build retains the pre-existing chunk-size warning for an output
  above 500 kB.
- Playwright retains the environment warning that `NO_COLOR` is ignored while
  `FORCE_COLOR` is set.

## Fix Round 1: Ordinal Diagnostics and Hostile Records

Addressed both P1 review findings.

- Diagnostics are now sorted with fixed ordinal comparisons by `code`, then
  `path`, then `message`; no locale-sensitive comparison is used.
- All untrusted record property reads and reference iteration are contained.
  A throwing getter or Proxy returns the literal `invalid_record_access`
  diagnostic at `$` instead of throwing. Internal code outside those untrusted
  access boundaries is not caught.

### TDD evidence

- Red: `npx playwright test tests/content-sdk-entity-validation.spec.ts`
  produced 2 expected failures: the old path-first order differed from the
  literal code-first order, and a throwing Proxy getter escaped
  `validateEntity`.
- Green: the same focused command passed all 4 tests after the containment and
  ordinal-sort implementation.

### Fix verification

- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npx playwright test` passed: 28 tests, with the existing
  `NO_COLOR`/`FORCE_COLOR` environment warnings.

## Fix Round 2: Bounded Hostile Reference Arrays

Added `MAX_REFERENCES_PER_ENTITY = 4096` and validate the untrusted `refs`
length before indexed iteration. A length must be a finite, non-negative safe
integer no greater than the bound; invalid or oversized lengths return the
existing literal `invalid_record_access` diagnostic.

### TDD evidence

- Red: a focused Playwright regression using an Array Proxy that reported
  `Infinity` for `length` reached the old unbounded indexed loop and did not
  progress. The run was interrupted after the preceding three tests completed,
  establishing the hang without leaving the worker running.
- Green: the same focused command passed all 5 tests after the length guard.

### Fix verification

- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npx playwright test` passed: 29 tests, with the existing
  `NO_COLOR`/`FORCE_COLOR` environment warnings.
