# Content Pack Manifest V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the separate `uo.game-content-pack/v1` manifest contract, deterministic integrity operations and draft/publication assessment to `@ultod/content-sdk`.

**Architecture:** The manifest inventories immutable artifacts while `game-content-graph/v1` remains the path-free resolved runtime model. Validation is pure and bounded, byte acquisition is delegated to a caller-supplied reader, and publication assessment performs no mutation or external call.

**Tech Stack:** TypeScript 5.6, browser Web Crypto, Playwright Test, npm workspaces

**Spec:** `docs/superpowers/specs/2026-08-27-content-pack-manifest-design.md`

## Global Constraints

- Keep `@ultod/content-sdk` at version `0.1.0` and zero runtime dependencies.
- Preserve all existing graph APIs and the empty graph SHA-256 `936a997048458bea95f6c4f37085bc034e05692384bb04e9aab9244a23eadb81`.
- Use only generic synthetic names; never import, discover or name the private game repository.
- Never perform filesystem, network, registry, WebAdmin or server access inside the SDK.
- Use caller-provided `ArtifactReader` and call it exactly once per validated artifact.
- Validate untrusted arrays and own keys without iterator or array-method dispatch.
- All diagnostics are deterministic and fail closed; no fallback pack or version exists.
- Follow strict red-green-refactor for every production behavior.

---

### Task 1: Manifest Types and Runtime Discriminants

**Files:**
- Create: `packages/content-sdk/src/pack-types.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-pack-types.spec.ts`

**Interfaces:**
- Consumes: `ValidationResult` and `GameContentGraph` from `src/types.ts` in later tasks.
- Produces: `CONTENT_ARTIFACT_ROLES`, `CONTENT_PROVENANCE_KINDS`, `ContentArtifact`, `ContentPackManifest`, `ContentPackEvidenceSummary`, `ArtifactReader` and related unions.

- [ ] **Step 1: Write the failing runtime/type contract test**

Create `tests/content-pack-types.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { ContentPackManifest } from "../packages/content-sdk/src";

test("exports frozen content-pack discriminants", () => {
  expect(Reflect.get(sdk, "CONTENT_ARTIFACT_ROLES")).toEqual(["graph", "entity", "asset"]);
  expect(Reflect.get(sdk, "CONTENT_PROVENANCE_KINDS")).toEqual([
    "original",
    "generated",
    "third-party",
  ]);
  expect(Object.isFrozen(Reflect.get(sdk, "CONTENT_ARTIFACT_ROLES"))).toBe(true);
  expect(Object.isFrozen(Reflect.get(sdk, "CONTENT_PROVENANCE_KINDS"))).toBe(true);
});

test("types a separate minimal graph artifact manifest", () => {
  const manifest: ContentPackManifest = {
    schema: "uo.game-content-pack/v1",
    id: "pack.example.empty",
    version: "1.0.0",
    status: "draft",
    visibility: "public",
    compatibility: {
      content_graph: "1.x",
      client_core: ">=0.2.0 <1.0.0",
      server_protocol: [],
    },
    artifacts: [{
      role: "graph",
      path: "content/graph.json",
      sha256: "0".repeat(64),
      media_type: "application/json",
      license: { id: "MIT" },
      provenance: { kind: "generated", source: "pack-build" },
    }],
  };

  expect(manifest.artifacts[0]?.role).toBe("graph");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx playwright test tests/content-pack-types.spec.ts --reporter=line
```

Expected: FAIL because the runtime and type exports do not exist.

- [ ] **Step 3: Add the exact manifest types**

Create `pack-types.ts` with the approved interfaces. Derive role and provenance unions from frozen tuples:

```ts
export const CONTENT_ARTIFACT_ROLES = Object.freeze(["graph", "entity", "asset"] as const);
export const CONTENT_PROVENANCE_KINDS = Object.freeze([
  "original",
  "generated",
  "third-party",
] as const);

export type ContentArtifactRole = (typeof CONTENT_ARTIFACT_ROLES)[number];
export type ContentProvenanceKind = (typeof CONTENT_PROVENANCE_KINDS)[number];
export type ContentPackStatus = "draft" | "published" | "deprecated";
export type ContentPackVisibility = "public" | "private" | "local";

export interface ContentArtifact {
  role: ContentArtifactRole;
  content_id?: string;
  path: string;
  sha256: string;
  media_type: string;
  license: { id: string };
  provenance: { kind: ContentProvenanceKind; source: string };
}

export interface ContentPackManifest {
  schema: "uo.game-content-pack/v1";
  id: string;
  version: string;
  status: ContentPackStatus;
  visibility: ContentPackVisibility;
  compatibility: {
    content_graph: string;
    client_core: string;
    server_protocol: string[];
  };
  artifacts: ContentArtifact[];
}

export interface ContentPackEvidenceSummary {
  artifact_count: number;
  license_ids: string[];
  provenance_kinds: ContentProvenanceKind[];
  provenance_sources: string[];
}

export type ArtifactReader = (path: string) => Promise<Uint8Array>;
```

Export runtime values and all types from `src/index.ts`.

- [ ] **Step 4: Run focused and SDK type gates**

Run:

```powershell
npx playwright test tests/content-pack-types.spec.ts --reporter=line
npm run check:content-sdk
```

Expected: 2 tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit Task 1**

```powershell
git add packages/content-sdk/src/pack-types.ts packages/content-sdk/src/index.ts tests/content-pack-types.spec.ts
git diff --cached --check
git commit -m "feat(content): add content pack manifest types"
```

---

### Task 2: Bounded Structural Validation

**Files:**
- Create: `packages/content-sdk/src/validate-pack.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-pack-validation.spec.ts`

**Interfaces:**
- Consumes: pack types from Task 1; `CONTENT_ID_PATTERN`, `SEMVER_PATTERN` and existing compatibility bounds from `validate-entity.ts`.
- Produces: `validateContentPackManifest(value: unknown): ValidationResult`, `isPortableArtifactPath(path: string): boolean`, `SHA256_PATTERN` and every manifest work-bound constant.

- [ ] **Step 1: Write literal RED tests for a valid manifest and path attacks**

Create a complete `validManifest` fixture using the design spec's graph and
entity artifacts, then add:

```ts
test("accepts a minimal graph-only draft manifest", () => {
  expect(validateContentPackManifest(validManifest)).toEqual({ valid: true, diagnostics: [] });
});

test("rejects nonportable paths without normalization", () => {
  for (const path of [
    "../secret.json",
    "/content/graph.json",
    "C:/content/graph.json",
    "res://content/graph.json",
    "content\\graph.json",
    "content/%2e%2e/secret.json",
    "content/graph.json?raw=1",
    "content/graph file.json",
  ]) {
    const result = validateContentPackManifest({
      ...validManifest,
      artifacts: [{ ...validManifest.artifacts[0], path }],
    });
    expect(result.diagnostics.map(({ code }) => code), path).toContain("invalid_artifact_path");
  }
});
```

Add literal tests for duplicate paths, duplicate `content_id`, no graph,
multiple graphs, missing/forbidden `content_id`, uppercase/short hashes,
malformed media/license/provenance, and empty compatibility strings.

- [ ] **Step 2: Run validation tests and verify RED**

```powershell
npx playwright test tests/content-pack-validation.spec.ts --reporter=line
```

Expected: FAIL because `validateContentPackManifest` is absent.

- [ ] **Step 3: Implement explicit constants and portable path validation**

Define and export:

```ts
export const MAX_PACK_OWN_KEYS = 64;
export const MAX_PACK_ARTIFACTS = 16_384;
export const MAX_ARTIFACT_OWN_KEYS = 16;
export const MAX_PACK_NESTED_OWN_KEYS = 16;
export const MAX_ARTIFACT_PATH_LENGTH = 1_024;
export const MAX_MEDIA_TYPE_LENGTH = 128;
export const MAX_LICENSE_ID_LENGTH = 128;
export const MAX_PROVENANCE_SOURCE_LENGTH = 256;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PORTABLE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isPortableArtifactPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_ARTIFACT_PATH_LENGTH) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("%")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment !== "." && segment !== ".." && PORTABLE_SEGMENT_PATTERN.test(segment),
  );
}
```

- [ ] **Step 4: Implement non-throwing bounded validation**

Use the existing validator pattern: `accessUntrusted`, explicit index loops,
single snapshots of `Reflect.ownKeys` and array length, and `sortDiagnostics`.
Read only the seven approved top-level fields and seven artifact fields.
Snapshot and bound compatibility, license and provenance own keys before
rejecting every key outside their exact approved envelopes.

Before expanding unknown keys:

```ts
if (ownKeys.length > MAX_PACK_OWN_KEYS) {
  return {
    valid: false,
    diagnostics: [{
      code: "pack_key_limit_exceeded",
      path: "$",
      message: `pack must contain at most ${MAX_PACK_OWN_KEYS} own keys`,
    }],
  };
}
```

Before artifact iteration, reject invalid or over-limit lengths with one
`artifact_limit_exceeded` diagnostic. Track path and `content_id` duplicates in
sets and count graph roles. Validate nested fields with explicit property reads.

- [ ] **Step 5: Add hostile-input and work-bound RED tests**

Add short-timeout tests:

```ts
test("caps diagnostics for 70,000 own keys", { timeout: 1_000 }, () => {
  const oversized = { ...validManifest } as Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) oversized[`unknown_${index}`] = index;
  expect(validateContentPackManifest(oversized)).toEqual({
    valid: false,
    diagnostics: [{
      code: "pack_key_limit_exceeded",
      path: "$",
      message: "pack must contain at most 64 own keys",
    }],
  });
});

test("fails closed when ownKeys throws", () => {
  const hostile = new Proxy(validManifest, {
    ownKeys() { throw new Error("hostile ownKeys"); },
  });
  expect(() => validateContentPackManifest(hostile)).not.toThrow();
  expect(validateContentPackManifest(hostile).diagnostics[0]?.code).toBe("invalid_pack_access");
});
```

Also test an artifacts proxy with `length: Infinity` and an array longer than
16,384. These tests must fail before the corresponding bounds are complete.

- [ ] **Step 6: Make all validation tests GREEN and run regressions**

```powershell
npx playwright test tests/content-pack-validation.spec.ts tests/content-sdk-entity-validation.spec.ts tests/content-sdk-graph-validation.spec.ts --reporter=line
npm run check:content-sdk
```

Expected: all focused tests pass and typecheck exits 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add packages/content-sdk/src/validate-pack.ts packages/content-sdk/src/index.ts tests/content-pack-validation.spec.ts
git diff --cached --check
git commit -m "feat(content): validate content pack manifests"
```

---

### Task 3: Canonicalization, Manifest Hash and Evidence Summary

**Files:**
- Create: `packages/content-sdk/src/normalize-pack.ts`
- Create: `packages/content-sdk/src/pack-hash.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-pack-normalization.spec.ts`

**Interfaces:**
- Consumes: `ContentPackManifest`, `ContentPackEvidenceSummary`, structural validator and patterns from Tasks 1-2.
- Produces: `ContentPackCanonicalizationError`, `normalizeContentPackManifest`, `serializeCanonicalContentPack`, `sha256CanonicalContentPack`, `summarizeContentPackEvidence`.

- [ ] **Step 1: Write canonical literal and order-independence RED tests**

Use a graph-only manifest and assert this exact canonical JSON:

```ts
const expected = '{"schema":"uo.game-content-pack/v1","id":"pack.example.empty","version":"1.0.0","status":"draft","visibility":"public","compatibility":{"content_graph":"1.x","client_core":">=0.2.0 <1.0.0","server_protocol":[]},"artifacts":[{"role":"graph","path":"content/graph.json","sha256":"0000000000000000000000000000000000000000000000000000000000000000","media_type":"application/json","license":{"id":"MIT"},"provenance":{"kind":"generated","source":"pack-build"}}]}';

test("serializes and hashes the minimal pack canonically", async () => {
  expect(serializeCanonicalContentPack(minimalManifest)).toBe(expected);
  await expect(sha256CanonicalContentPack(minimalManifest)).resolves.toBe(
    "b327fe0a88a8947d7c52267c24443c3ce5ec43e86d5abd1ef221716d93ec7c19",
  );
});
```

Add two three-artifact manifests with reversed insertion order and expect
identical serialization. Snapshot the original value and assert no mutation.

- [ ] **Step 2: Run normalization tests and verify RED**

```powershell
npx playwright test tests/content-pack-normalization.spec.ts --reporter=line
```

Expected: FAIL because normalization exports are absent.

- [ ] **Step 3: Implement explicit canonical projection**

Validate first and throw `ContentPackCanonicalizationError` using the first
sorted structural diagnostic when invalid. Copy compatibility protocols by
index. Copy each artifact into a new object with exact field order, omitting
`content_id` only when absent. Sort copied artifacts with this comparator:

```ts
function compareArtifacts(left: ContentArtifact, right: ContentArtifact): number {
  return compareOrdinal(left.role, right.role) ||
    compareOrdinal(left.content_id ?? "", right.content_id ?? "") ||
    compareOrdinal(left.path, right.path) ||
    compareOrdinal(left.sha256, right.sha256);
}
```

Do not spread or iterate untrusted arrays. Use explicit index loops and object
literals after structural validation.

- [ ] **Step 4: Implement hash and evidence summary**

`sha256CanonicalContentPack` must use browser Web Crypto exactly like the graph
hash. `summarizeContentPackEvidence` validates, normalizes and returns unique
ordinally sorted values:

```ts
return {
  artifact_count: normalized.artifacts.length,
  license_ids: [...new Set(normalized.artifacts.map((item) => item.license.id))].sort(compareOrdinal),
  provenance_kinds: [...new Set(normalized.artifacts.map((item) => item.provenance.kind))].sort(compareOrdinal),
  provenance_sources: [...new Set(normalized.artifacts.map((item) => item.provenance.source))].sort(compareOrdinal),
};
```

The implementation may use array methods only on the newly created trusted
normalized array, never on caller input.

- [ ] **Step 5: Add RED evidence and hostile-canonicalization tests**

Test a manifest with repeated licenses/sources and assert a literal unique
sorted report. Test unknown keys, throwing getters and a throwing `ownKeys` trap
produce a typed error with stable code/path rather than data loss.

- [ ] **Step 6: Run normalization, graph-hash and package gates**

```powershell
npx playwright test tests/content-pack-normalization.spec.ts tests/content-sdk-normalization.spec.ts --reporter=line
npm run check:content-sdk
npm --workspace @ultod/content-sdk run build
```

Expected: both canonical suites pass; the existing empty graph hash is unchanged.

- [ ] **Step 7: Commit Task 3**

```powershell
git add packages/content-sdk/src/normalize-pack.ts packages/content-sdk/src/pack-hash.ts packages/content-sdk/src/index.ts tests/content-pack-normalization.spec.ts
git diff --cached --check
git commit -m "feat(content): canonicalize content pack manifests"
```

---

### Task 4: Caller-Supplied Integrity Verification

**Files:**
- Create: `packages/content-sdk/src/sha256.ts`
- Create: `packages/content-sdk/src/verify-pack.ts`
- Modify: `packages/content-sdk/src/hash.ts`
- Modify: `packages/content-sdk/src/pack-hash.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-pack-integrity.spec.ts`

**Interfaces:**
- Consumes: `ArtifactReader`, normalized manifests and `ValidationResult`.
- Produces: internal shared `sha256Bytes(bytes: Uint8Array): Promise<string>` and public `verifyContentPackIntegrity(manifest, readArtifact): Promise<ValidationResult>`.

- [ ] **Step 1: Write integrity RED tests against a real in-memory reader**

Use the known SHA-256 of UTF-8 `hello`:

```ts
const helloHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

test("reads each canonical artifact exactly once and verifies bytes", async () => {
  const calls: string[] = [];
  const reader: ArtifactReader = async (path) => {
    calls.push(path);
    return new TextEncoder().encode("hello");
  };
  const manifest = {
    ...validManifest,
    artifacts: validManifest.artifacts.map((artifact) => ({ ...artifact, sha256: helloHash })),
  };

  await expect(verifyContentPackIntegrity(manifest, reader)).resolves.toEqual({
    valid: true,
    diagnostics: [],
  });
  expect(calls).toEqual(["content/realms/start.json", "content/graph.json"]);
});
```

Add separate literal tests where the reader throws, returns a non-`Uint8Array`
through an unsafe cast, and returns mismatching bytes.

- [ ] **Step 2: Run integrity tests and verify RED**

```powershell
npx playwright test tests/content-pack-integrity.spec.ts --reporter=line
```

Expected: FAIL because integrity verification is absent.

- [ ] **Step 3: Extract a shared byte hash helper without changing graph output**

Create:

```ts
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

Make both graph and pack canonical hash functions call `sha256Bytes` on a
`TextEncoder` result. Run the existing graph hash test immediately after this
refactor.

- [ ] **Step 4: Implement bounded integrity verification**

Validate then normalize the manifest. For each canonical artifact by numeric
index, await exactly one reader call inside `try/catch`. Add one diagnostic at
`artifacts[index].path` for unavailable/invalid bytes or a mismatch. Continue
through the bounded artifact array, then sort diagnostics by code/path/message.

Do not retry, run requests concurrently, or read an alternative path.

- [ ] **Step 5: Run focused and full hash regressions**

```powershell
npx playwright test tests/content-pack-integrity.spec.ts tests/content-pack-normalization.spec.ts tests/content-sdk-normalization.spec.ts --reporter=line
npm run check:content-sdk
```

Expected: all tests pass, exact graph and pack hashes remain literal.

- [ ] **Step 6: Commit Task 4**

```powershell
git add packages/content-sdk/src/sha256.ts packages/content-sdk/src/verify-pack.ts packages/content-sdk/src/hash.ts packages/content-sdk/src/pack-hash.ts packages/content-sdk/src/index.ts tests/content-pack-integrity.spec.ts
git diff --cached --check
git commit -m "feat(content): verify content pack integrity"
```

---

### Task 5: Publication Assessment, Documentation and CI Gate

**Files:**
- Create: `packages/content-sdk/src/assess-pack-publication.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-pack-publication.spec.ts`
- Create: `docs/content/GAME-CONTENT-PACK-V1.md`
- Modify: `packages/content-sdk/README.md`
- Modify: `README.md`
- Modify: `.github/workflows/docs-validation.yml`

**Interfaces:**
- Consumes: `validateContentPackManifest`, `validateContentGraph`, pack/graph types.
- Produces: `assessContentPackPublication(manifest, graph): ValidationResult` and the documented complete public contract.

- [ ] **Step 1: Write publication RED tests**

Build one closed graph containing `realm.example.start` and a manifest with a
graph artifact plus a matching entity artifact. Assert the fully compatible
case is valid. Then write independent tests for:

```ts
test("allows draft validation but blocks publication without a server protocol", () => {
  expect(validateContentPackManifest(draftManifest).valid).toBe(true);
  expect(assessContentPackPublication(draftManifest, validGraph)).toEqual({
    valid: false,
    diagnostics: [{
      code: "missing_server_protocol_compatibility",
      path: "compatibility.server_protocol",
      message: "publication requires at least one declared server protocol",
    }],
  });
});
```

Add tests for deprecated status, visibility mismatch, missing entity artifact,
orphan entity artifact, wrong graph media type, wrong entity media type, invalid
graph and invalid manifest. Expected diagnostics must be literal and sorted.

- [ ] **Step 2: Run publication tests and verify RED**

```powershell
npx playwright test tests/content-pack-publication.spec.ts --reporter=line
```

Expected: FAIL because the assessment export is absent.

- [ ] **Step 3: Implement pure publication assessment**

Call both structural validators through guarded access. Prefix manifest
diagnostics with `manifest.` and graph diagnostics with `graph.`. If either is
invalid, return sorted prefixed diagnostics without reading deeper fields.

For valid values, use sets built from numeric loops to compare graph entity IDs
and entity artifact `content_id` values. Add the exact blockers from the spec.
Define a local ordinal comparator and sort by `code`, then `path`, then
`message`. Return `{ valid: diagnostics.length === 0, diagnostics }` after that
in-place sort.

- [ ] **Step 4: Document the complete contract**

Create `GAME-CONTENT-PACK-V1.md` with the approved JSON example, field tables,
portable path grammar, every bound, validation/integrity/publication flow,
diagnostic table and API list. Update the package README and root README to link
the contract and state that no source is fetched automatically.

- [ ] **Step 5: Extend CI with the four pack suites**

In `docs-validation.yml`, add the pack files to the existing content SDK test
command:

```yaml
- name: Test content SDK
  run: >-
    npx playwright test
    tests/content-sdk-types.spec.ts
    tests/content-sdk-entity-validation.spec.ts
    tests/content-sdk-graph-validation.spec.ts
    tests/content-sdk-normalization.spec.ts
    tests/content-pack-types.spec.ts
    tests/content-pack-validation.spec.ts
    tests/content-pack-normalization.spec.ts
    tests/content-pack-integrity.spec.ts
    tests/content-pack-publication.spec.ts
```

- [ ] **Step 6: Run all local release gates in dependency order**

```powershell
npm run test:e2e -- --reporter=line
npm run check:content-sdk
npm --workspace @ultod/content-sdk run build
npm run build
npm run check:public-boundary
npm audit --omit=dev
npm --workspace @ultod/content-sdk run build
npm pack --workspace @ultod/content-sdk --dry-run --json
git diff --check
```

Expected: zero test failures, both builds exit 0, boundary output `[]`, production
audit reports 0 vulnerabilities, and the sequential pack contains compiled JS
and declarations with no bundled/runtime dependencies.

- [ ] **Step 7: Commit Task 5**

```powershell
git add packages/content-sdk/src/assess-pack-publication.ts packages/content-sdk/src/index.ts tests/content-pack-publication.spec.ts docs/content/GAME-CONTENT-PACK-V1.md packages/content-sdk/README.md README.md .github/workflows/docs-validation.yml
git diff --cached --check
git commit -m "docs(content): complete content pack v1 contract"
```

---

### Final Review Gate

- [ ] Compare every public export and diagnostic against the design spec.
- [ ] Verify each new production behavior has a test observed RED before GREEN.
- [ ] Confirm no private names, paths, endpoints, credentials or binary assets appear.
- [ ] Confirm manifest order does not affect canonical bytes or integrity reader order.
- [ ] Confirm all caller-controlled collections and property reads are bounded/fail-closed.
- [ ] Run the complete release gates from Task 5 again on the final tree.
- [ ] Review `git diff 8de97c2..HEAD` for scope and accidental files.
- [ ] Do not merge, push, tag or publish until final review reports zero Critical/Important findings.
