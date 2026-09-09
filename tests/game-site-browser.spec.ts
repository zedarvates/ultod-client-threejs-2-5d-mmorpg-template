import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { renderGameSite } from "../packages/game-site-generator/src";
import type { GameManifest } from "../packages/game-site-generator/src";
import { startGeneratedSiteServer } from "./helpers/generated-site-server";

const here = dirname(fileURLToPath(import.meta.url));

async function fixture(): Promise<GameManifest> {
  return JSON.parse(await readFile(
    join(here, "../examples/game-site/tutorial/game.manifest.json"),
    "utf8",
  )) as GameManifest;
}

test("generated production site is semantic, keyboard accessible and network silent", async ({ page }) => {
  const server = await startGeneratedSiteServer(await renderGameSite(await fixture(), "production"));
  try {
    await page.goto(`${server.url}/index.html`);
    await expect(page).toHaveTitle("Frontier Tutorial");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Page sections" })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Isometric exploration" })).toBeVisible();

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    expect(await skip.evaluate((element) => getComputedStyle(element).outlineWidth)).not.toBe("0px");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    await page.waitForLoadState("networkidle");
    expect([...server.requests].sort()).toEqual(["/index.html", "/styles.css"]);
    await expect(page.locator('[data-site-mode="preview"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("generated page fits tablet and desktop viewports with reduced motion", async ({ page }) => {
  const server = await startGeneratedSiteServer(await renderGameSite(await fixture(), "production"));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const viewport of [{ width: 320, height: 720 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${server.url}/index.html`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => {
      const styles = [...document.querySelectorAll("*")].map((element) => getComputedStyle(element));
      return styles.every((style) => style.animationDuration === "0s" && style.transitionDuration === "0s");
    })).toBe(true);
    expect(await page.locator("html").evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe("auto");
  } finally {
    await server.close();
  }
});

test("generated preview displays its warning and no-index directive", async ({ page }) => {
  const manifest = await fixture();
  manifest.visibility = "private";
  manifest.publication.web = false;
  manifest.packages = { client_core: "unresolved", content_sdk: "unresolved", site_generator: "unresolved" };
  manifest.content_graph = "unresolved";
  const server = await startGeneratedSiteServer(await renderGameSite(manifest, "preview"));
  try {
    await page.goto(`${server.url}/index.html`);
    await expect(page.getByText("Preview — not published", { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  } finally {
    await server.close();
  }
});
