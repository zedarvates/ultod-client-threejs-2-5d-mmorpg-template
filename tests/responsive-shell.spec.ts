import { expect, test, type Locator, type Page } from "@playwright/test";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function rect(locator: Locator): Promise<Rect> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error(`Bounds unavailable for ${locator}`);
  return bounds;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}

async function readPosition(page: Page): Promise<{ x: number; z: number }> {
  const hud = await page.locator("#hud").textContent();
  const match = hud?.match(/pos \((-?\d+\.\d+), (-?\d+\.\d+)\)/);
  if (!match) throw new Error("HUD position unavailable");
  return { x: Number(match[1]), z: Number(match[2]) };
}

async function moveUntil(
  page: Page,
  key: "w" | "a" | "s" | "d",
  reached: (position: { x: number; z: number }) => boolean,
): Promise<void> {
  for (let step = 0; step < 90; step += 1) {
    if (reached(await readPosition(page))) return;
    await page.keyboard.down(key);
    await page.waitForTimeout(80);
    await page.keyboard.up(key);
  }
  throw new Error(`Could not reach responsive target while moving ${key}`);
}

async function walkToKing(page: Page): Promise<void> {
  await expect.poll(() => page.locator("#hud").textContent()).toMatch(/pos \(/);
  const start = await readPosition(page);
  if (Math.abs(start.x - -0.75) > 0.5) {
    await moveUntil(page, start.x < -0.75 ? "d" : "a", (position) => Math.abs(position.x - -0.75) <= 0.7);
  }
  const middle = await readPosition(page);
  if (Math.abs(middle.z - -5.25) > 0.5) {
    await moveUntil(page, middle.z < -5.25 ? "s" : "w", (position) => Math.abs(position.z - -5.25) <= 0.7);
  }
}

test.describe("mobile portrait shell", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 568 } });

  test("top overlays reflow without collision at 320 CSS pixels", async ({ page }) => {
    await page.goto("/");

    const hud = await rect(page.locator("#hud"));
    const quest = await rect(page.locator("#quest-panel"));
    const maps = await rect(page.getByRole("button", { name: "Cartes" }));

    expect(overlaps(hud, quest)).toBe(false);
    expect(overlaps(hud, maps)).toBe(false);
    expect(overlaps(quest, maps)).toBe(false);
    await expectNoHorizontalOverflow(page);
  });

  test("map and interaction controls provide 44 pixel touch targets", async ({ page }) => {
    await page.goto("/");

    const maps = page.getByRole("button", { name: "Cartes" });
    expect((await rect(maps)).height).toBeGreaterThanOrEqual(44);
    expect((await rect(page.getByRole("button", { name: "Interagir" }))).height).toBeGreaterThanOrEqual(44);

    await maps.click();
    const navigation = page.getByRole("navigation", { name: "Choisir une carte" });
    const panel = await rect(navigation);
    const mapToggle = await rect(maps);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(320);
    expect(panel.y + panel.height).toBeLessThanOrEqual(568);
    expect(overlaps(panel, mapToggle)).toBe(false);

    const links = navigation.getByRole("link");
    for (let index = 0; index < await links.count(); index += 1) {
      expect((await rect(links.nth(index))).height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("short landscape shell", () => {
  test.use({ hasTouch: true, viewport: { width: 568, height: 320 } });

  test("quest and gameplay controls remain in separate regions", async ({ page }) => {
    await page.goto("/");

    const hud = await rect(page.locator("#hud"));
    const quest = await rect(page.locator("#quest-panel"));
    const maps = await rect(page.getByRole("button", { name: "Cartes" }));
    const inventory = await rect(page.locator("#inventory"));
    const interaction = await rect(page.getByRole("button", { name: "Interagir" }));
    const joystick = await rect(page.locator("#joystick-zone"));

    expect(overlaps(hud, quest)).toBe(false);
    expect(overlaps(hud, maps)).toBe(false);
    expect(overlaps(quest, maps)).toBe(false);
    expect(overlaps(quest, inventory)).toBe(false);
    expect(overlaps(quest, interaction)).toBe(false);
    expect(overlaps(quest, joystick)).toBe(false);
    await expectNoHorizontalOverflow(page);
  });

  test("dialog stays inside the viewport with a 44 pixel action", async ({ page }) => {
    await page.goto("/");
    await walkToKing(page);
    await page.getByRole("button", { name: "Interagir" }).click();

    const dialog = await rect(page.getByRole("dialog", { name: "King Aldric" }));
    const action = await rect(page.getByRole("button", { name: "I will save her!" }));
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.y).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(568);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(320);
    expect(action.height).toBeGreaterThanOrEqual(44);
  });
});
