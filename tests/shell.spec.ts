import { test, expect } from "@playwright/test";

/** The shell must boot without page errors and render the HUD. */
test("shell boots with HUD and no fatal error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#app-canvas")).toBeVisible();
  // Wait for the render loop to produce at least one frame.
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

/** The HUD must display the fail-closed network stub state. */
test("HUD shows offline fail-closed network state", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  const hud = await page.locator("#hud").textContent();
  expect(hud).toContain("net: offline");
});

/** WebGL canvas must actually paint non-background pixels (render loop alive). */
test("canvas renders non-empty frame", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2000);
  const canvas = page.locator("#app-canvas");
  const shot = await canvas.screenshot();
  // A fully blank canvas would compress to a tiny PNG. Rendered 3D content
  // produces significantly more data. Threshold is generous for CI.
  expect(shot.length).toBeGreaterThan(2000);
});

test("non-critical prop GLBs wait until after critical startup", async ({ page }) => {
  const propGlbRequests: string[] = [];
  await page.route("**/assets/props/*.glb", async (route) => {
    propGlbRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#quest-panel")).toBeVisible();
  await page.waitForTimeout(300);

  expect(propGlbRequests).toEqual([]);
});

test("deferred prop loading never requests public asset GLBs", async ({ page }) => {
  const propGlbRequests: string[] = [];
  await page.route("**/assets/props/*.glb", async (route) => {
    propGlbRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.waitForTimeout(2500);

  expect(propGlbRequests).toEqual([]);
});
