import { expect, test, type Page } from "@playwright/test";

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
  throw new Error(`Could not reach accessibility target while moving ${key}`);
}

async function walkTo(page: Page, x: number, z: number): Promise<void> {
  const start = await readPosition(page);
  if (Math.abs(start.x - x) > 0.5) {
    await moveUntil(page, start.x < x ? "d" : "a", (position) => Math.abs(position.x - x) <= 0.7);
  }
  const middle = await readPosition(page);
  if (Math.abs(middle.z - z) > 0.5) {
    await moveUntil(page, middle.z < z ? "s" : "w", (position) => Math.abs(position.z - z) <= 0.7);
  }
}

test("viewport keeps browser zoom available", async ({ page }) => {
  await page.goto("/");

  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
  expect(viewport).not.toMatch(/maximum-scale\s*=\s*1/i);
});

test("canvas exposes the playable world to assistive technology", async ({ page }) => {
  await page.goto("/");

  const world = page.getByRole("img", { name: "Playable isometric world" });
  await expect(world).toBeVisible();
  await expect(world).toHaveAccessibleDescription(/keyboard, pointer, or touch controls/i);
});

test("gameplay status surfaces announce meaningful changes", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#hud")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#network-status")).toHaveAttribute("role", "status");
  await expect(page.locator("#network-status")).toContainText("net: offline");
  await expect(page.locator("#quest-panel")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#inventory")).toHaveAttribute("aria-live", "polite");
});

test("quest and inventory live regions expose real gameplay changes", async ({ page }) => {
  await page.goto("/");

  await walkTo(page, -0.75, -5.25);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "I will save her!" }).click();
  await expect(page.locator("#quest-panel")).toContainText("Buy a sword from the Merchant (50g). You have 75g.");

  await walkTo(page, 0.75, -2.25);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "Buy sword (50g)" }).click();
  await expect(page.locator("#quest-panel")).toContainText("Slay the Beast (red creature) north of the village.");
  await expect(page.locator("#inv-sword")).toHaveAttribute("aria-label", "Sword: equipped");
});

test("unchanged quest and inventory status do not remount every frame", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);

  const mutations = await page.evaluate(async () => {
    const targets = [document.getElementById("quest-panel"), document.getElementById("inventory")]
      .filter((target): target is HTMLElement => target instanceof HTMLElement);
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    for (const target of targets) {
      observer.observe(target, { attributes: true, characterData: true, childList: true, subtree: true });
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    observer.disconnect();
    return count;
  });

  expect(mutations).toBe(0);
});

test.describe("touch dialog flow", () => {
  test.use({ hasTouch: true, viewport: { width: 768, height: 600 } });

  test("modal dialog traps focus, blocks gameplay, and restores its trigger", async ({ page }) => {
    await page.goto("/");
    await walkTo(page, -0.75, -5.25);

    const trigger = page.getByRole("button", { name: "Interagir" });
    await page.mouse.click(650, 300);
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "King Aldric" });
    const action = page.getByRole("button", { name: "I will save her!" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(action).toBeFocused();
    await expect(page.locator("#app-canvas")).toHaveAttribute("inert", "");
    await expect(page.locator("#map-selector")).toHaveAttribute("inert", "");

    const afterOpen = await readPosition(page);
    await page.waitForTimeout(250);
    expect(await readPosition(page)).toEqual(afterOpen);

    await page.keyboard.press("Tab");
    await expect(action).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(action).toBeFocused();

    const beforeKeyboard = await readPosition(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(250);
    await page.keyboard.up("w");
    expect(await readPosition(page)).toEqual(beforeKeyboard);

    const beforePointer = await readPosition(page);
    await page.evaluate(() => {
      const state = window as typeof window & { __accessibilityCanvasClicks?: number };
      state.__accessibilityCanvasClicks = 0;
      document.getElementById("app-canvas")?.addEventListener("click", () => {
        state.__accessibilityCanvasClicks = (state.__accessibilityCanvasClicks ?? 0) + 1;
      });
    });
    await page.mouse.click(80, 300);
    await page.waitForTimeout(250);
    expect(await readPosition(page)).toEqual(beforePointer);
    expect(await page.evaluate(() => (
      window as typeof window & { __accessibilityCanvasClicks?: number }
    ).__accessibilityCanvasClicks ?? 0)).toBe(0);

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("opening a modal cancels active joystick movement", async ({ page }) => {
    await page.goto("/");
    await walkTo(page, -0.75, -5.25);

    const joystick = page.locator("#joystick-zone");
    const joystickBox = await joystick.boundingBox();
    if (!joystickBox) throw new Error("Joystick bounds unavailable");
    await page.mouse.move(
      joystickBox.x + joystickBox.width - 6,
      joystickBox.y + joystickBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(100);

    const trigger = page.getByRole("button", { name: "Interagir" });
    const triggerBox = await trigger.boundingBox();
    if (!triggerBox) throw new Error("Interaction button bounds unavailable");
    await page.touchscreen.tap(
      triggerBox.x + triggerBox.width / 2,
      triggerBox.y + triggerBox.height / 2,
    );

    const dialog = page.getByRole("dialog", { name: "King Aldric" });
    await expect(dialog).toBeVisible();
    const afterOpen = await readPosition(page);
    await page.waitForTimeout(250);
    const afterWait = await readPosition(page);
    await page.mouse.up();

    expect(afterWait).toEqual(afterOpen);
  });

  test("releasing a held movement key during the modal prevents movement after dismissal", async ({ page }) => {
    await page.goto("/");
    await walkTo(page, -0.75, -5.25);

    await page.keyboard.down("w");
    const trigger = page.getByRole("button", { name: "Interagir" });
    const triggerBox = await trigger.boundingBox();
    if (!triggerBox) throw new Error("Interaction button bounds unavailable");
    await page.touchscreen.tap(
      triggerBox.x + triggerBox.width / 2,
      triggerBox.y + triggerBox.height / 2,
    );

    const dialog = page.getByRole("dialog", { name: "King Aldric" });
    await expect(dialog).toBeVisible();
    await page.keyboard.up("w");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const afterDismissal = await readPosition(page);
    await page.waitForTimeout(250);
    expect(await readPosition(page)).toEqual(afterDismissal);
  });
});
