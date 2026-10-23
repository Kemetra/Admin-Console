import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

/**
 * `@axe-core/playwright` is typed against the playwright-core of `@e2e-dev/web`
 * (a newer minor than `@playwright/test`'s), so the two `Page` types differ
 * though the runtime object is the same.
 */
function axeFor(page: Page): AxeBuilder {
  return new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
  });
}

/**
 * Waits for every finite CSS animation and transition to finish. A colour
 * transition (a theme switch, a hover) or an rtc-settle fade-in caught mid-flight
 * gives axe a blended colour, and color-contrast then fails on a frame no user
 * reads. Infinite animations (the spinner) never finish, so they are skipped.
 */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** WCAG 2.1 A/AA over the settled page; fails with the rule ids and their targets. */
export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  await settleAnimations(page);
  const results = await axeFor(page)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  // Guard against a vacuous pass: the engine must have evaluated rules here.
  expect(results.passes.length, label).toBeGreaterThan(10);
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    label,
  ).toEqual([]);
}
