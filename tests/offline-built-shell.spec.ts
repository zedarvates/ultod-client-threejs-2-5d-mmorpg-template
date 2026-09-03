import { expect, test } from "@playwright/test";

async function expectBuiltDemoReady(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.body.dataset.bootState)).toBe("ready");
  await expect.poll(() => page.evaluate(() => document.body.dataset.demoRuntime)).toBe("ready");
  await expect.poll(() => page.evaluate(() => document.body.dataset.demoProof)).toBe("SYNTHETIC_FIXTURE_ONLY");
  await expect(page.locator("#app-canvas")).toBeVisible();
  await expect(page.locator("#hud")).toContainText("net: online (player 42)");
  await expect.poll(() => page.evaluate(() => {
    const client = window.__ultodLocalDemoClient;
    return client?.getState().mode ?? "missing";
  })).toBe("online");
}

test("built Three.js shell and local demo runtime reload while offline after first load", async ({ page, context }) => {
  await page.goto("./", { waitUntil: "networkidle" });
  await expectBuiltDemoReady(page);

  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const ready = await navigator.serviceWorker.ready;
    return { scope: ready.scope, controlled: Boolean(navigator.serviceWorker.controller) };
  });
  expect(registration).not.toBeNull();

  // The first navigation may finish before clients.claim(); reload once while online
  // so the page is unquestionably controlled before simulating loss of network.
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expectBuiltDemoReady(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectBuiltDemoReady(page);
});
