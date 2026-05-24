import { expect, test } from "@playwright/test";

const landingSectionIds = [
  "hero",
  "value-proposition",
  "product-promise",
  "how-it-works",
  "model-clarity",
  "activity-intelligence",
  "trust-privacy",
  "final-cta",
] as const;

const responsiveViewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "tv", width: 3300, height: 2100 },
] as const;

for (const viewport of responsiveViewports) {
  test(`landing keeps sections contained at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });

    const layoutState = await page.evaluate((sectionIds) => {
      const doc = document.documentElement;

      return {
        documentOverflow: doc.scrollWidth > doc.clientWidth + 1,
        sectionOverflows: sectionIds
          .map((id) => {
            const section = document.getElementById(id);

            if (!section) {
              return { id, missing: true, scrollWidth: 0, clientWidth: 0 };
            }

            return {
              id,
              missing: false,
              scrollWidth: section.scrollWidth,
              clientWidth: section.clientWidth,
            };
          })
          .filter((entry) => entry.missing || entry.scrollWidth > entry.clientWidth + 1),
      };
    }, landingSectionIds);

    expect(layoutState.documentOverflow).toBe(false);
    expect(layoutState.sectionOverflows).toEqual([]);
  });
}

test("how-it-works stays interactive on desktop-sized viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.locator("#how-it-works [data-how-it-works-track]")).toHaveCount(1);
});

test("how-it-works falls back to the static stack on TV-sized viewports", async ({ page }) => {
  await page.setViewportSize({ width: 3300, height: 2100 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.locator("#how-it-works [data-how-it-works-track]")).toHaveCount(0);
  await expect(page.locator("#how-it-works article")).toHaveCount(5);
});

test("product-promise stacks cards below the image on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });

  const geometry = await page.evaluate(() => {
    const section = document.getElementById("product-promise");
    const image = section?.querySelector("img");
    const firstCard = section?.querySelector('[class*="LandingProductPromiseSection_card"]');

    if (!section || !image || !firstCard) {
      return null;
    }

    const imageRect = image.getBoundingClientRect();
    const cardRect = firstCard.getBoundingClientRect();

    return {
      imageBottom: imageRect.bottom,
      imageHeight: imageRect.height,
      firstCardTop: cardRect.top,
      firstCardHeight: cardRect.height,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry?.imageHeight ?? 0).toBeGreaterThan(120);
  expect(geometry?.firstCardHeight ?? 0).toBeGreaterThan(120);
  expect(geometry?.firstCardTop ?? 0).toBeGreaterThanOrEqual((geometry?.imageBottom ?? 0) - 1);
});