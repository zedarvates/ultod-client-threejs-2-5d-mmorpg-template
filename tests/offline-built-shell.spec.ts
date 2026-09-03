import { expect, test } from "@playwright/test";

test("built Three.js shell reloads while offline after first load", async ({ page, context }) => {
  await page.goto("./", { waitUntil: "networkidle" });
  await expect.poll(() => page.evaluate(() => document.body.dataset.bootState)).toBe("ready");

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
  await expect.poll(() => page.evaluate(() => document.body.dataset.bootState)).toBe("ready");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => document.body.dataset.bootState)).toBe("ready");
  await expect(page.locator("#app-canvas")).toBeVisible();
});
