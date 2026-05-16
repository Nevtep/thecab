import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/design-system"];

for (const route of routes) {
  test(`a11y smoke ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("body", { timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules([
        "color-contrast",
        // Tamagui Spinner uses role=progressbar without a stable name hook
        "aria-progressbar-name",
      ])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test("landing has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const viewWidth = document.documentElement.clientWidth;
    return docWidth > viewWidth + 1;
  });

  expect(overflow).toBe(false);
});
