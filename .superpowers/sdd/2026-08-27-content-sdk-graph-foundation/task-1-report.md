# Task 1 Report: Content SDK Shared Types

## Scope

Implemented the public `@ultod/content-sdk` workspace package with zero runtime
dependencies and shared `game-content-graph/v1` TypeScript contracts.

## TDD evidence

- Red: `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck tests/content-sdk-types.spec.ts` failed with `TS2307`: the SDK source module did not exist.
- Note: the prescribed Playwright command transpiles TypeScript without typechecking, so it passed while the import was type-only and the SDK source was absent. The explicit TypeScript contract compilation above records the required meaningful red state.
- Green: after the minimal package and type implementation, the same TypeScript command completed with `TypeScript: No errors found`.
- Green: `npx playwright test tests/content-sdk-types.spec.ts` passed (1 test).

## Verification

- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed.
- `npm run test:e2e` passed: 23 tests.
- `git diff --check` passed.
- `npm run check:public-boundary` passed.

## Package boundary

- `packages/content-sdk/package.json` declares no runtime dependencies.
- SDK types and test fixture contain no private game names, paths, lore, or assets.

## Observed warnings

- Vite reports an existing output chunk above 500 kB during the root build.
- Playwright child processes report that `NO_COLOR` is ignored because `FORCE_COLOR` is set.
- `npm install` reports two existing audit findings (one moderate and one high); no dependency was added to the SDK runtime boundary.

## Fix Round 1: Runtime Content-Kind Contract

The original type-only import was erased by Playwright's TypeScript transform,
so it could not establish the required Playwright red state. This fix exports a
runtime `CONTENT_KINDS` readonly tuple and derives `ContentKind` from it.

The brief's literal enumeration contains 24 kinds, despite the review request
calling it 26; this tuple preserves the 24 explicitly named kinds and does not
invent two unspecified categories.

### TDD evidence

- Red command: `npx playwright test tests/content-sdk-types.spec.ts`
- Red output: `PASS (1) FAIL (1)`; `Expected: ["realm", "region", "biome", "settlement", "location", "dungeon", "route", "threshold", "faction", "character", …]`; `Received: undefined` at `expect(sdk.CONTENT_KINDS).toEqual(...)`.
- Green command: `npx playwright test tests/content-sdk-types.spec.ts`
- Green output: `PASS (2) FAIL (0)`.

### Fix verification

- `npm run check:content-sdk` passed.
- `npm --workspace @ultod/content-sdk run build` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npm run test:e2e` passed: 24 tests, with the existing `NO_COLOR`/`FORCE_COLOR` environment warnings.
