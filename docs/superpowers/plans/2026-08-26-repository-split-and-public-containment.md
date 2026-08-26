# Repository Split and Public Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the private *The Last Open Threshold* repository, preserve its approved lore, and make the public template independent of private lore and unresolved GLB licenses without breaking the live demo.

**Architecture:** The public repository keeps generic Three.js code and procedural demonstration geometry. The private repository becomes the only current source for game-specific lore and artwork planning. Existing public history is not rewritten; historical releases are annotated, while current `main` and the next public release remove the private lore and unresolved binaries.

**Tech Stack:** Git/GitHub CLI, TypeScript 5, Three.js, Vite, Playwright, Node.js 22+, PowerShell, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-26-template-game-content-architecture-design.md`

## Global Constraints

- The new GitHub repository is `zedarvates/the-last-open-threshold` with visibility `private`.
- The local private checkout is `C:\the-last-open-threshold`.
- Public Git history is not rewritten and existing tags are not deleted.
- Public packages and code must not import, discover or name the private repository.
- The public demo must run without private lore, private access or binary GLB assets.
- All content migration is hash-verified before public deletion.
- No private token, endpoint, absolute path or commercial asset enters public files.
- All new public geometry is original procedural Three.js code under MIT.
- Every production behavior change follows red-green-refactor TDD.
- No new public tag is created until the binary-license blocker is removed from current `main`.

## Program Decomposition

The approved architecture contains independently reviewable subsystems. This
plan implements the first safety-critical subproject: repository separation and
public containment. Subsequent subprojects receive separate implementation
plans after this plan has terminal evidence:

1. public package extraction and `game-content-graph/v1` content SDK;
2. StoryCore and legacy-registry draft adapters;
3. deterministic game-site generator and synthetic tutorial-world;
4. WebAdmin private/public content-pack integration;
5. private web vertical slice and, after its gates, Steam packaging.

---

## File Structure

### Private repository files

```text
C:\the-last-open-threshold\
  README.md                         # private product boundary and setup
  LICENSE.md                        # all-rights-reserved private-game notice
  package.json                      # private workspace metadata
  game.manifest.json                # private game identity and package requirements
  content/lore/WORLD-LORE.md        # migrated approved canon
  content/art/ARTWORK-BACKLOG.md    # migrated approved production list
  docs/ORIGIN-AND-CONTAINMENT.md    # public-history disclosure record
```

### Public repository files

```text
src/render/procedural-template-props.ts     # original tile/rock primitives
src/render/procedural-creature-parts.ts     # original semantic creature primitives
src/render/prop-loader.ts                   # scene installation without GLB requests
src/render/creature-bridge.ts               # optional GLB resolver + procedural fallback
scripts/check-public-boundary.mjs           # tracked-content privacy/license scan
tests/procedural-assets.spec.ts              # procedural geometry contracts
tests/public-boundary.spec.ts                # no private names or tracked GLBs
tests/shell.spec.ts                          # no GLB request contract
README.md                                    # generic template boundary
ROADMAP.md                                   # blocker resolution state
docs/ASSET-LICENSE-AUDIT.md                  # resolved-current / historical note
docs/PUBLIC-EXTRACTION-DESIGN.md             # corrected current state
```

The following public files are removed after verified private migration:

```text
docs/lore/TEMPLATE-WORLD-LORE.md
docs/lore/ARTWORK-PRODUCTION-LIST.md
public/assets/props/ground_tile_01.glb
public/assets/props/rock_small_01.glb
public/creatures/parts/ear_wolf_01.glb
public/creatures/parts/eye_normal_01.glb
public/creatures/parts/head_beak_01.glb
public/creatures/parts/leg_insect_01.glb
public/creatures/parts/tail_whip_01.glb
public/creatures/parts/wing_bat_01.glb
```

---

### Task 1: Preflight Both Repository Boundaries

**Files:**
- Read: `.git/config`
- Read: `docs/lore/TEMPLATE-WORLD-LORE.md`
- Read: `docs/lore/ARTWORK-PRODUCTION-LIST.md`
- Read: `docs/ASSET-LICENSE-AUDIT.md`
- Create during execution only: `C:\Users\redga\AppData\Local\Temp\threshold-sha256.ps1`
- Create during execution only: `C:\Users\redga\AppData\Local\Temp\threshold-split-preflight.ps1`
- Create during execution only: `C:\Users\redga\AppData\Local\Temp\threshold-split-preflight.json`

**Interfaces:**
- Consumes: current public `HEAD`, GitHub authentication, approved lore files.
- Produces: immutable preflight record containing source commit, source hashes and private-repository availability.

- [ ] **Step 1: Confirm the public checkout is clean and synchronized**

Run:

```powershell
rtk git status
rtk git rev-parse HEAD
rtk git branch -vv
rtk git remote -v
```

Expected: clean worktree on `main`, tracking `origin/main`. Stop if unrelated changes exist.

- [ ] **Step 2: Check whether the private repository already exists**

Run:

```powershell
gh repo view zedarvates/the-last-open-threshold --json name,isPrivate,url,defaultBranchRef
```

Expected: either a not-found response, or `isPrivate: true`. Stop if an existing repository is public.

- [ ] **Step 3: Record source hashes without reading private credentials**

Create `threshold-sha256.ps1` with `apply_patch`:

```powershell
param([Parameter(Mandatory = $true)][string]$Path)
$stream = [System.IO.File]::OpenRead($Path)
try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash($stream)
        [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
} finally {
    $stream.Dispose()
}
```

Create `threshold-split-preflight.ps1` with `apply_patch`:

```powershell
param(
    [string]$RepoRoot = 'C:/ultod-client-threejs-2-5d-mmorpg-template',
    [string]$OutputPath = 'C:/Users/redga/AppData/Local/Temp/threshold-split-preflight.json'
)
$hashScript = 'C:/Users/redga/AppData/Local/Temp/threshold-sha256.ps1'
$paths = @(
    'docs/lore/TEMPLATE-WORLD-LORE.md',
    'docs/lore/ARTWORK-PRODUCTION-LIST.md'
)
$files = foreach ($relativePath in $paths) {
    $absolutePath = Join-Path $RepoRoot $relativePath
    $hash = & powershell -NoProfile -File $hashScript -Path $absolutePath
    [ordered]@{ path = $relativePath; sha256 = $hash.Trim() }
}
$record = [ordered]@{
    schema = 'uo.repository-split-preflight/v1'
    public_commit = (git -C $RepoRoot rev-parse HEAD).Trim()
    files = $files
}
$json = $record | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
```

Run:

```powershell
powershell -NoProfile -File C:\Users\redga\AppData\Local\Temp\threshold-split-preflight.ps1
```

It computes SHA-256 for:

```text
docs/lore/TEMPLATE-WORLD-LORE.md
docs/lore/ARTWORK-PRODUCTION-LIST.md
```

The output object uses schema `uo.repository-split-preflight/v1`, a
`public_commit` string matching `^[0-9a-f]{40}$`, and exactly two `files`
entries containing the specified repository-relative path plus a SHA-256 string
matching `^[0-9a-f]{64}$`.

- [ ] **Step 4: Verify the preflight record**

Run:

```powershell
Get-Content -LiteralPath C:\Users\redga\AppData\Local\Temp\threshold-split-preflight.json -Raw | ConvertFrom-Json
```

Expected: two files, non-empty commit, 64-character hashes.

- [ ] **Step 5: Commit nothing**

This task is an evidence gate. Proceed only when the public worktree remains clean.

---

### Task 2: Create the Private Game Repository

**Files:**
- Create: `C:\the-last-open-threshold\README.md`
- Create: `C:\the-last-open-threshold\LICENSE.md`
- Create: `C:\the-last-open-threshold\package.json`
- Create: `C:\the-last-open-threshold\game.manifest.json`
- Create: `C:\the-last-open-threshold\.gitignore`

**Interfaces:**
- Consumes: successful Task 1 preflight.
- Produces: private GitHub repository and local checkout with initial product metadata.

- [ ] **Step 1: Create the local repository directory safely**

Resolve and verify that `C:\the-last-open-threshold` does not contain unrelated files. Then run:

```powershell
New-Item -ItemType Directory -Path C:\the-last-open-threshold
git -C C:\the-last-open-threshold init -b main
```

If the directory already exists, verify its Git remote and privacy before reuse.

- [ ] **Step 2: Add private product metadata with `apply_patch`**

`package.json`:

```json
{
  "name": "the-last-open-threshold",
  "version": "0.0.0-private",
  "private": true,
  "description": "Private game project built on the UltOd Three.js client core.",
  "engines": { "node": ">=22" }
}
```

`game.manifest.json`:

```json
{
  "schema": "uo.game-manifest/v1",
  "id": "game.the-last-open-threshold",
  "name": "The Last Open Threshold",
  "visibility": "private",
  "version": "0.0.0-private",
  "packages": {
    "client_core": "unresolved",
    "content_sdk": "unresolved",
    "site_generator": "unresolved"
  },
  "content_graph": "unresolved",
  "publication": { "web": false, "steam": false }
}
```

`LICENSE.md`:

```markdown
# Private Game License

Copyright (c) 2026 Ultimate Odycer. All rights reserved.

This private game repository, its lore, artwork, audio and game-specific data
are not licensed for redistribution unless a separate written license says so.
Public dependencies retain their own licenses.
```

`README.md`:

```markdown
# The Last Open Threshold

Private commercial game project built on the public UltOd Three.js client
packages. The repository contains private lore, game-specific content and
commercial production assets.

## Boundaries

- Visibility must remain private.
- Public engine code is consumed through versioned packages.
- Game lore and assets are never copied back into public packages.
- Web and Steam publication remain disabled until their explicit gates pass.
```

`.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
site/generated/
steam/build/
*.log
```

- [ ] **Step 3: Test private metadata**

Run:

```powershell
node -e "const p=require('C:/the-last-open-threshold/package.json'); if(!p.private) process.exit(1)"
node -e "const m=require('C:/the-last-open-threshold/game.manifest.json'); if(m.visibility!=='private') process.exit(1)"
```

Expected: both commands exit 0.

- [ ] **Step 4: Create the private GitHub repository**

Run only if Task 1 proved it does not already exist:

```powershell
gh repo create zedarvates/the-last-open-threshold --private --source C:\the-last-open-threshold --remote origin
```

Then verify:

```powershell
gh repo view zedarvates/the-last-open-threshold --json isPrivate,url
```

Expected: `isPrivate: true`.

- [ ] **Step 5: Commit and push the private skeleton**

```powershell
git -C C:\the-last-open-threshold add README.md LICENSE.md package.json game.manifest.json .gitignore
git -C C:\the-last-open-threshold commit -m "chore: initialize private game repository"
git -C C:\the-last-open-threshold push -u origin main
```

---

### Task 3: Migrate and Verify Private Lore

**Files:**
- Create: `C:\the-last-open-threshold\content\lore\WORLD-LORE.md`
- Create: `C:\the-last-open-threshold\content\art\ARTWORK-BACKLOG.md`
- Create: `C:\the-last-open-threshold\docs\ORIGIN-AND-CONTAINMENT.md`
- Read: `C:\Users\redga\AppData\Local\Temp\threshold-split-preflight.json`

**Interfaces:**
- Consumes: exact public lore documents and Task 1 hashes.
- Produces: hash-identical private copies and an origin record.

- [ ] **Step 1: Copy the two approved documents exactly**

Use `Copy-Item -LiteralPath` for the exact migration:

```powershell
New-Item -ItemType Directory -Force C:\the-last-open-threshold\content\lore
New-Item -ItemType Directory -Force C:\the-last-open-threshold\content\art
Copy-Item -LiteralPath C:\ultod-client-threejs-2-5d-mmorpg-template\docs\lore\TEMPLATE-WORLD-LORE.md -Destination C:\the-last-open-threshold\content\lore\WORLD-LORE.md
Copy-Item -LiteralPath C:\ultod-client-threejs-2-5d-mmorpg-template\docs\lore\ARTWORK-PRODUCTION-LIST.md -Destination C:\the-last-open-threshold\content\art\ARTWORK-BACKLOG.md
```

- [ ] **Step 2: Write the containment record**

Create `docs/ORIGIN-AND-CONTAINMENT.md` with:

```markdown
# Origin and Public Containment

The initial lore design was discussed and briefly committed to the public
template repository as commit `9b615ea` before the private-product boundary was
chosen. Public history was not rewritten. Current and future canonical lore is
maintained only in this private repository.

The public tutorial uses a separate synthetic world and must not reuse private
names, answers, artwork or raw conversation text.
```

- [ ] **Step 3: Verify migrated hashes against preflight**

Run the same SHA-256 helper from Task 1 against the private destination files.

Expected:

```text
WORLD-LORE.md hash == TEMPLATE-WORLD-LORE.md preflight hash
ARTWORK-BACKLOG.md hash == ARTWORK-PRODUCTION-LIST.md preflight hash
```

Stop before public deletion if either comparison fails.

- [ ] **Step 4: Commit and push private lore**

```powershell
git -C C:\the-last-open-threshold add content docs/ORIGIN-AND-CONTAINMENT.md
git -C C:\the-last-open-threshold commit -m "docs: preserve private world canon and artwork backlog"
git -C C:\the-last-open-threshold push
```

---

### Task 4: Replace Public Prop GLBs with Procedural Geometry

**Files:**
- Create: `src/render/procedural-template-props.ts`
- Modify: `src/render/prop-loader.ts`
- Create: `tests/procedural-assets.spec.ts`

**Interfaces:**
- Consumes: `THREE.Scene`.
- Produces: `createProceduralTemplateProps(scene: THREE.Scene): THREE.Group`.

- [ ] **Step 1: Write the failing procedural-props test**

```typescript
import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createProceduralTemplateProps } from "../src/render/procedural-template-props";

test("procedural template props install an original tile and rock", () => {
  const scene = new THREE.Scene();
  const group = createProceduralTemplateProps(scene);

  expect(scene.children).toContain(group);
  expect(group.getObjectByName("tutorial_ground_tile")).toBeTruthy();
  expect(group.getObjectByName("tutorial_rock")).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify red**

Run:

```powershell
npx playwright test tests/procedural-assets.spec.ts -g "procedural template props"
```

Expected: FAIL because `procedural-template-props` does not exist.

- [ ] **Step 3: Implement deterministic original primitives**

Create:

```typescript
import * as THREE from "three";

export function createProceduralTemplateProps(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = "tutorial_procedural_props";

  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.08, 1),
    new THREE.MeshLambertMaterial({ color: 0x6f756f }),
  );
  tile.name = "tutorial_ground_tile";
  tile.position.set(0, 0.04, 0);
  tile.receiveShadow = true;

  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 1),
    new THREE.MeshLambertMaterial({ color: 0x77736c, flatShading: true }),
  );
  rock.name = "tutorial_rock";
  rock.scale.set(1, 0.65, 0.8);
  rock.position.set(3, 0.3, -2);
  rock.castShadow = true;

  group.add(tile, rock);
  scene.add(group);
  return group;
}
```

Change `loadTemplateProps` to call this function synchronously and remove
`GLTFLoader`, URLs and network-error handling.

- [ ] **Step 4: Run focused and shell tests**

```powershell
npx playwright test tests/procedural-assets.spec.ts tests/shell.spec.ts
```

Expected: PASS; no GLB request is needed for public props.

- [ ] **Step 5: Commit**

```powershell
git add src/render/procedural-template-props.ts src/render/prop-loader.ts tests/procedural-assets.spec.ts
git commit -m "feat: replace public prop GLBs with procedural geometry"
```

---

### Task 5: Add Procedural Creature-Part Fallbacks

**Files:**
- Create: `src/render/procedural-creature-parts.ts`
- Modify: `src/render/creature-bridge.ts`
- Modify: `src/main.ts`
- Modify: `tests/procedural-assets.spec.ts`

**Interfaces:**
- Consumes: semantic `partId: string`.
- Produces: `createProceduralCreaturePart(partId: string): THREE.Object3D`.
- Modifies: `buildCreature(genome, options)` where `options.resolvePartUrl` is optional.

- [ ] **Step 1: Write the failing semantic-part test**

```typescript
import { createProceduralCreaturePart } from "../src/render/procedural-creature-parts";

test("procedural creature fallback covers every tutorial genome part", () => {
  for (const id of ["head_beak_01", "wing_bat_01", "tail_whip_01", "leg_insect_01"]) {
    const part = createProceduralCreaturePart(id);
    expect(part.name).toBe(`procedural_${id}`);
    expect(part.children.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run the test to verify red**

```powershell
npx playwright test tests/procedural-assets.spec.ts -g "creature fallback"
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal semantic factory**

Use only Three.js primitives:

```typescript
import * as THREE from "three";

export function createProceduralCreaturePart(partId: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `procedural_${partId}`;
  const material = new THREE.MeshLambertMaterial({ color: 0x3eb489, flatShading: true });

  const geometry = partId.startsWith("wing_")
    ? new THREE.ConeGeometry(0.35, 0.9, 3)
    : partId.startsWith("tail_")
      ? new THREE.ConeGeometry(0.12, 0.8, 6)
      : partId.startsWith("leg_")
        ? new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6)
        : new THREE.ConeGeometry(0.18, 0.5, 6);

  group.add(new THREE.Mesh(geometry, material));
  return group;
}
```

Refactor `buildCreature` so a missing resolver uses the procedural factory.
When a resolver exists but loading fails, replace the failed part with the same
procedural fallback and record a warning without failing the scene.

- [ ] **Step 4: Stop resolving private tutorial part URLs**

In `src/main.ts`, call `buildCreature` without a URL resolver for the public
tutorial creature.

- [ ] **Step 5: Run focused and full scenario tests**

```powershell
npx playwright test tests/procedural-assets.spec.ts tests/scenario.spec.ts
```

Expected: PASS, including the complete rescue journey.

- [ ] **Step 6: Commit**

```powershell
git add src/render/procedural-creature-parts.ts src/render/creature-bridge.ts src/main.ts tests/procedural-assets.spec.ts
git commit -m "feat: add procedural creature parts for public demo"
```

---

### Task 6: Remove Public Lore and Binary Assets from Current Main

**Files:**
- Delete: `docs/lore/TEMPLATE-WORLD-LORE.md`
- Delete: `docs/lore/ARTWORK-PRODUCTION-LIST.md`
- Delete: eight GLBs listed in File Structure
- Delete: `public/assets/props/PROVENANCE.md`
- Delete: `public/creatures/parts/PROVENANCE.md`
- Modify: `README.md`
- Modify: `docs/PUBLIC-EXTRACTION-DESIGN.md`
- Modify: `docs/ASSET-LICENSE-AUDIT.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: Task 3 private hash verification and Tasks 4–5 procedural replacements.
- Produces: current public branch with no private lore and no tracked GLB.

- [ ] **Step 1: Verify the private destination again**

Run:

```powershell
git -C C:\the-last-open-threshold status
git -C C:\the-last-open-threshold log -2 --oneline
gh repo view zedarvates/the-last-open-threshold --json isPrivate
```

Expected: clean private worktree, lore commit present, `isPrivate: true`.

- [ ] **Step 2: Remove text files with `apply_patch` and binaries with `git rm`**

Use `apply_patch` delete directives for Markdown files. Use explicit `git rm --`
paths for binary GLBs; do not use globs.

- [ ] **Step 3: Update public documentation precisely**

Required statements:

- private game lore moved to a distinct private repository;
- commit `9b615ea` remains in public history;
- current `main` contains no private game lore or private binary assets;
- public demo uses original procedural geometry;
- the binary audit is retained as a historical record, marked
  `current-main-resolved / historical-releases-annotate`;
- next release gate remains blocked until historical releases are annotated.

- [ ] **Step 4: Verify tracked boundaries**

```powershell
git ls-files "*.glb"
git grep -n -I -E "Lumeris|Seris Vale|Orin Veyr|The Last Open Threshold" -- . ":(exclude)docs/superpowers/specs/**" ":(exclude)docs/superpowers/plans/**"
```

Expected: no tracked GLB and no private-game names outside historical design and
plan documentation. The architecture documents may name the private product
only to define the boundary.

- [ ] **Step 5: Run build and all tests**

```powershell
npm run build
npm run test:e2e
```

Expected: build exit 0 and complete Playwright suite PASS.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: contain private game content outside public template"
```

---

### Task 7: Add an Automated Public Boundary Gate

**Files:**
- Create: `scripts/check-public-boundary.mjs`
- Create: `tests/public-boundary.spec.ts`
- Modify: `package.json`
- Modify: `.github/workflows/docs-validation.yml`

**Interfaces:**
- Produces: `classifyBoundaryEntry(path: string, text: string): Finding[]`.
- Produces: `scanPublicBoundary(root: string): Promise<Finding[]>`.
- CLI exits 0 when clean and 1 with JSON findings when blocked.

- [ ] **Step 1: Write the failing boundary test**

```typescript
import { test, expect } from "@playwright/test";
import {
  classifyBoundaryEntry,
  scanPublicBoundary,
} from "../scripts/check-public-boundary.mjs";

test("public boundary classifies binary assets and private lore", () => {
  expect(classifyBoundaryEntry("public/creatures/part.glb", "")).toEqual([{
    code: "tracked-binary-asset",
    path: "public/creatures/part.glb",
    detail: "Public policy blocks .glb files",
  }]);

  expect(classifyBoundaryEntry("docs/lore/world.md", "Princess Seris Vale")[0]?.code)
    .toBe("private-lore-name");
});

test("public boundary rejects GLBs and private lore names", async () => {
  const findings = await scanPublicBoundary(process.cwd());
  expect(findings).toEqual([]);
});
```

Task 6 has already removed the current findings. The first test proves classifier
behavior against explicit fixtures; the second proves the real current tree is
clean.

- [ ] **Step 2: Run the test to verify red**

```powershell
npx playwright test tests/public-boundary.spec.ts
```

Expected: FAIL because `check-public-boundary.mjs` does not exist.

- [ ] **Step 3: Implement deterministic scanning**

The scanner checks tracked files returned by `git ls-files -z` and reports:

```typescript
export interface Finding {
  code: "tracked-binary-asset" | "private-lore-name" | "private-path";
  path: string;
  detail: string;
}

export function classifyBoundaryEntry(path: string, text: string): Finding[];
export function scanPublicBoundary(root: string): Promise<Finding[]>;
```

Rules:

- `.glb`, `.blend`, `.fbx` and `.gltf` are blocked under current public policy;
- private lore names are blocked outside the architecture spec/plan and release
  containment records;
- absolute paths containing `C:\the-last-open-threshold` are blocked outside
  implementation plans;
- output order is lexicographically stable.

- [ ] **Step 4: Add package and CI commands**

`package.json`:

```json
"check:public-boundary": "node scripts/check-public-boundary.mjs"
```

Add a workflow step before documentation link validation:

```yaml
- name: Validate public/private content boundary
  run: node scripts/check-public-boundary.mjs
```

- [ ] **Step 5: Run test and CLI**

```powershell
npx playwright test tests/public-boundary.spec.ts
npm run check:public-boundary
```

Expected: both pass with no findings.

- [ ] **Step 6: Commit**

```powershell
git add scripts/check-public-boundary.mjs tests/public-boundary.spec.ts package.json package-lock.json .github/workflows/docs-validation.yml
git commit -m "ci: enforce public and private content boundary"
```

---

### Task 8: Annotate Historical Releases and Publish a Clean Patch

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/ASSET-LICENSE-AUDIT.md`
- Modify: `ROADMAP.md`
- Create with `apply_patch` during execution: temporary release-note files under
  `C:\Users\redga\AppData\Local\Temp\ultod-release-notes\`

**Interfaces:**
- Consumes: clean current public boundary and full tests.
- Produces: warnings on `v0.1.0`–`v0.1.2`, clean patch release, updated P0 issue.

- [ ] **Step 1: Preserve and append historical release notes**

For each tag `v0.1.0`, `v0.1.1`, `v0.1.2`:

1. Read each current body with `gh release view v0.1.0 --json body`, then
   `v0.1.1`, then `v0.1.2`.
2. Create a temporary note file with `apply_patch` containing the original body
   plus:

```markdown
> Historical notice (2026-08-26): this archive contains early binary demo
> assets whose public redistribution terms were not fully documented. Current
> releases replace them with original procedural geometry. Do not reuse those
> historical binaries independently.
```

3. Run the exact matching command:

```powershell
gh release edit v0.1.0 --notes-file C:\Users\redga\AppData\Local\Temp\ultod-release-notes\v0.1.0.md
gh release edit v0.1.1 --notes-file C:\Users\redga\AppData\Local\Temp\ultod-release-notes\v0.1.1.md
gh release edit v0.1.2 --notes-file C:\Users\redga\AppData\Local\Temp\ultod-release-notes\v0.1.2.md
```

Do not delete tags, releases or history.

- [ ] **Step 2: Update current release documentation**

Add a changelog section describing:

- private repository split;
- procedural asset replacement;
- public-boundary CI gate;
- historical release annotations;
- exact test count.

- [ ] **Step 3: Run final release gates**

```powershell
git diff --check
npm run check:public-boundary
npm run build
npm run test:e2e
npm audit --omit=dev
```

Expected: all commands exit 0; no vulnerabilities; no tracked binary findings.

- [ ] **Step 4: Validate a fresh clone**

Clone current `main` into a unique temporary directory. Run:

```powershell
npm install --no-fund --no-audit
npx playwright install chromium
npm run check:public-boundary
npm run build
npm run test:e2e
```

Expected: all pass without access to the private repository.

- [ ] **Step 5: Commit, push and create the clean patch tag**

Set the public package and lockfile version to `0.1.3`. Update changelog and
roadmap, then:

```powershell
git add -A
git commit -m "release: publish private-content-free public template"
git tag -a v0.1.3 -m "Private-content-free public template"
git push origin main --tags
```

- [ ] **Step 6: Verify GitHub Actions and Pages**

```powershell
gh run list --repo zedarvates/ultod-client-threejs-2-5d-mmorpg-template --limit 4
```

Wait for documentation validation and Pages deployment to reach terminal
`success`. Verify the live HTML references the new bundle hash.

- [ ] **Step 7: Update the P0 issue**

Comment on issue `#2` with:

- private repository created and verified private;
- current public branch contains no listed binaries;
- historical releases annotated;
- clean release tag and CI URLs;
- any remaining historical limitation.

Close the issue only if its exact exit criteria are satisfied.

---

## Plan Completion Evidence

This plan is complete only when:

- the private repository exists and contains hash-verified lore;
- current public `main` contains no private lore files or GLBs;
- the public demo uses procedural assets and remains playable;
- public-boundary CI passes in a fresh clone;
- old releases carry historical warnings;
- a clean public patch release is live;
- all tests, build, audit and Pages checks have terminal evidence.
