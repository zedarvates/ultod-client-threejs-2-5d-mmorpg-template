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

async function expectSyntheticMovementAck(
  page: import("@playwright/test").Page,
  x: number,
  z: number,
): Promise<void> {
  const update = await page.evaluate(({ x, z }) => new Promise<{ playerId: number; x: number; z: number }>((resolve, reject) => {
    const client = window.__ultodLocalDemoClient;
    if (!client || client.getState().mode !== "online") {
      reject(new Error("local demo NetworkClient is not online"));
      return;
    }

    const timer = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("timed out waiting for synthetic position acknowledgement"));
    }, 1500);

    const unsubscribe = client.onPosition((position) => {
      window.clearTimeout(timer);
      unsubscribe();
      resolve(position);
    });

    client.sendMovement(x, z);
  }), { x, z });

  expect(update.playerId).toBe(42);
  expect(update.x).toBeCloseTo(x, 4);
  expect(update.z).toBeCloseTo(z, 4);
}

test("built Three.js shell and local demo runtime reload while offline after first load", async ({ page, context }) => {
  await page.goto("./", { waitUntil: "networkidle" });
  await expectBuiltDemoReady(page);
  await expectSyntheticMovementAck(page, 1.25, -2.5);

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
  await expectSyntheticMovementAck(page, -0.75, 0.5);
});
