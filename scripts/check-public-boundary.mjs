import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BLOCKED_EXTENSIONS = new Set([".glb", ".blend", ".fbx", ".gltf"]);
const PRIVATE_LORE_NAMES = [
  ["Lum", "eris"].join(""),
  ["Princess", "Seris", "Vale"].join(" "),
  ["Orin", "Veyr"].join(" "),
  ["The", "Last", "Open", "Threshold"].join(" "),
];
const LORE_BOUNDARY_RECORDS = new Set([
  "docs/superpowers/specs/2026-08-26-template-game-content-architecture-design.md",
  "docs/superpowers/plans/2026-08-26-repository-split-and-public-containment.md",
  "docs/PUBLIC-EXTRACTION-DESIGN.md",
  "docs/ASSET-LICENSE-AUDIT.md",
  "CHANGELOG.md",
]);

/**
 * @typedef {{
 *   code: "tracked-binary-asset" | "private-lore-name" | "private-path" | "unapproved-public-asset-manifest",
 *   path: string,
 *   detail: string,
 * }} Finding
 */

function isLoreBoundaryRecord(path) {
  return LORE_BOUNDARY_RECORDS.has(path);
}

/**
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function classifyBoundaryEntry(path, text) {
  const findings = [];
  const extension = extname(path).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(extension)) {
    findings.push({
      code: "tracked-binary-asset",
      path,
      detail: `Public policy blocks ${extension} files`,
    });
  }

  if (path.startsWith("public/") && extension === ".json") {
    try {
      const manifest = JSON.parse(text);
      const license = manifest && typeof manifest === "object" && !Array.isArray(manifest)
        ? manifest.license
        : undefined;
      const awaitsApproval = manifest && typeof manifest === "object" && !Array.isArray(manifest)
        && (manifest.delivery_status === "review_only"
          || manifest.requires_artist_review === true
          || (license && typeof license === "object" && !Array.isArray(license)
            && license.status === "project_review_required"));
      if (awaitsApproval) {
        findings.push({
          code: "unapproved-public-asset-manifest",
          path,
          detail: "Public policy blocks asset manifests awaiting redistribution approval",
        });
      }
    } catch {
      // JSON validity belongs to the owning schema validator.
    }
  }

  if (!isLoreBoundaryRecord(path)) {
    for (const name of PRIVATE_LORE_NAMES) {
      if (text.toLocaleLowerCase("en-US").includes(name.toLocaleLowerCase("en-US"))) {
        findings.push({
          code: "private-lore-name",
          path,
          detail: `Public policy blocks private lore name ${JSON.stringify(name)}`,
        });
      }
    }

  }

  if (!path.startsWith("docs/superpowers/plans/")
      && /C:\\the-last-open-threshold/i.test(text)) {
    findings.push({
      code: "private-path",
      path,
      detail: "Public policy blocks C:\\the-last-open-threshold outside implementation plans",
    });
  }

  return findings;
}

/**
 * @param {string} root
 * @returns {Promise<Finding[]>}
 */
export async function scanPublicBoundary(root) {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  const paths = stdout.toString("utf8").split("\0").filter(Boolean).sort(compareText);
  const findings = [];

  for (const path of paths) {
    const text = await readFile(join(root, path), "utf8");
    findings.push(...classifyBoundaryEntry(path, text));
  }

  return findings.sort((left, right) => compareText(left.path, right.path)
    || compareText(left.code, right.code)
    || compareText(left.detail, right.detail));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = await scanPublicBoundary(process.cwd());

  console.log(JSON.stringify(findings, null, 2));
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}
