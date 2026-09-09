import { createHash } from "node:crypto";
import { escapeHtmlAttribute, escapeHtmlText } from "./escape.js";
import { sha256CanonicalGameManifest } from "./hash.js";
import { GAME_SITE_GENERATOR_VERSION } from "./version.js";
import type {
  GameManifest,
  GameManifestDiagnostic,
  GeneratedGameSite,
  GeneratedSiteFile,
  SiteGenerationMode,
} from "./types.js";
import { validateGameManifest } from "./validate.js";

const encoder = new TextEncoder();

export class GameSiteGenerationError extends Error {
  public readonly diagnostics: readonly GameManifestDiagnostic[];

  constructor(diagnostics: readonly GameManifestDiagnostic[]) {
    super("game manifest cannot be rendered");
    this.name = "GameSiteGenerationError";
    this.diagnostics = Object.freeze(diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic })));
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function file(
  path: GeneratedSiteFile["path"],
  mediaType: GeneratedSiteFile["mediaType"],
  text: string,
): GeneratedSiteFile {
  const bytes = encoder.encode(text);
  return { path, mediaType, bytes, sha256: sha256(bytes) };
}

function renderHtml(manifest: GameManifest, mode: SiteGenerationMode): string {
  const site = manifest.site;
  const previewHead = mode === "preview"
    ? '  <meta name="robots" content="noindex,nofollow">\n'
    : "";
  const previewBanner = mode === "preview"
    ? '  <aside class="preview-banner" role="status">Preview — not published</aside>\n'
    : "";
  const features = site.features.map((feature) => [
    '        <li class="feature-card">',
    `          <h3>${escapeHtmlText(feature.title)}</h3>`,
    `          <p>${escapeHtmlText(feature.description)}</p>`,
    "        </li>",
  ].join("\n")).join("\n");
  const credits = site.credits.map((credit) => (
    `        <li><span>${escapeHtmlText(credit.role)}</span> ${escapeHtmlText(credit.name)}</li>`
  )).join("\n");
  const externalLinks = site.links.length === 0
    ? ""
    : [
        '      <ul class="external-links">',
        ...site.links.map((link) => (
          `        <li><a href="${escapeHtmlAttribute(link.url)}">${escapeHtmlText(link.label)}</a></li>`
        )),
        "      </ul>",
      ].join("\n");

  return [
    "<!doctype html>",
    `<html lang="${escapeHtmlAttribute(site.locale)}">`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <meta name="description" content="${escapeHtmlAttribute(site.synopsis)}">`,
    previewHead.trimEnd(),
    `  <title>${escapeHtmlText(manifest.name)}</title>`,
    '  <link rel="stylesheet" href="./styles.css">',
    "</head>",
    `<body data-site-mode="${mode}">`,
    '  <a class="skip-link" href="#main-content">Skip to content</a>',
    previewBanner.trimEnd(),
    '  <header class="hero">',
    '    <div class="shell">',
    `      <p class="eyebrow">${escapeHtmlText(manifest.version)}</p>`,
    `      <h1>${escapeHtmlText(manifest.name)}</h1>`,
    `      <p class="tagline">${escapeHtmlText(site.tagline)}</p>`,
    `      <p class="synopsis">${escapeHtmlText(site.synopsis)}</p>`,
    "    </div>",
    "  </header>",
    '  <nav class="site-nav" aria-label="Page sections">',
    '    <div class="shell"><a href="#features">Features</a><a href="#world">World</a><a href="#credits">Credits</a></div>',
    "  </nav>",
    '  <main id="main-content" tabindex="-1">',
    '    <section id="features" class="shell section">',
    "      <h2>Features</h2>",
    '      <ul class="feature-grid">',
    features,
    "      </ul>",
    "    </section>",
    '    <section id="world" class="shell section surface">',
    `      <h2>${escapeHtmlText(site.world.heading)}</h2>`,
    `      <p>${escapeHtmlText(site.world.body)}</p>`,
    "    </section>",
    '    <section id="credits" class="shell section">',
    "      <h2>Credits</h2>",
    '      <ul class="credits">',
    credits,
    "      </ul>",
    "    </section>",
    "  </main>",
    "  <footer>",
    '    <div class="shell">',
    `      <p>${escapeHtmlText(site.legal.copyright)}</p>`,
    `      <p>${escapeHtmlText(site.legal.notice)}</p>`,
    externalLinks,
    "    </div>",
    "  </footer>",
    "</body>",
    "</html>",
    "",
  ].filter((line) => line !== "").join("\n") + "\n";
}

function renderCss(manifest: GameManifest): string {
  const theme = manifest.site.theme;
  return `:root {
  color-scheme: dark;
  --background: ${theme.background};
  --surface: ${theme.surface};
  --text: ${theme.text};
  --muted: ${theme.muted};
  --accent: ${theme.accent};
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--background); }
body { margin: 0; min-width: 0; overflow-wrap: anywhere; background: var(--background); color: var(--text); }
a { color: var(--text); text-underline-offset: 0.2em; }
a:focus-visible, [tabindex="-1"]:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
.skip-link { position: fixed; left: 1rem; top: 1rem; z-index: 10; padding: 0.7rem 1rem; background: var(--surface); transform: translateY(-200%); }
.skip-link:focus { transform: translateY(0); }
.shell { width: min(68rem, calc(100% - 2rem)); margin-inline: auto; }
.preview-banner { padding: 0.65rem 1rem; text-align: center; border-bottom: 3px solid var(--accent); background: var(--surface); font-weight: 700; }
.hero { padding: clamp(4rem, 12vw, 9rem) 0 clamp(3rem, 8vw, 6rem); border-bottom: 1px solid var(--accent); }
.eyebrow { color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em; }
h1 { max-width: 18ch; margin: 0; font-size: clamp(2.4rem, 9vw, 6.5rem); line-height: 0.95; }
.tagline { max-width: 42rem; font-size: clamp(1.2rem, 3vw, 1.8rem); }
.synopsis { max-width: 52rem; color: var(--muted); }
.site-nav { position: sticky; top: 0; z-index: 5; background: var(--surface); border-bottom: 1px solid var(--accent); }
.site-nav .shell { display: flex; flex-wrap: wrap; gap: 1rem; padding-block: 0.8rem; }
.section { padding-block: clamp(3rem, 8vw, 6rem); }
.surface { padding-inline: clamp(1rem, 4vw, 3rem); background: var(--surface); border: 1px solid var(--accent); }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 1rem; padding: 0; list-style: none; }
.feature-card { padding: 1.25rem; background: var(--surface); border: 1px solid var(--accent); }
.credits, .external-links { padding-left: 1.25rem; }
.credits span { color: var(--muted); }
footer { padding-block: 2rem; color: var(--muted); border-top: 1px solid var(--accent); }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
`;
}

export async function renderGameSite(
  value: unknown,
  mode: SiteGenerationMode,
): Promise<GeneratedGameSite> {
  const validation = validateGameManifest(value, mode);
  if (!validation.valid || !validation.manifest) throw new GameSiteGenerationError(validation.diagnostics);
  const manifest = validation.manifest;
  const manifestSha256 = await sha256CanonicalGameManifest(manifest);
  const html = file("index.html", "text/html; charset=utf-8", renderHtml(manifest, mode));
  const css = file("styles.css", "text/css; charset=utf-8", renderCss(manifest));
  const metadataText = `${JSON.stringify({
    schema: "uo.generated-game-site/v1",
    generator_version: GAME_SITE_GENERATOR_VERSION,
    mode,
    game_id: manifest.id,
    game_version: manifest.version,
    manifest_sha256: manifestSha256,
    files: [
      { path: html.path, bytes: html.bytes.length, sha256: html.sha256 },
      { path: css.path, bytes: css.bytes.length, sha256: css.sha256 },
    ],
  }, null, 2)}\n`;
  const metadata = file("site-metadata.json", "application/json", metadataText);
  return { manifestSha256, files: [html, css, metadata] };
}
