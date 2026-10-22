import type { Page } from "./fixtures";

/** Presses Tab from `start` and returns the aria-label of each stop, `count` stops long. */
export async function tabOrder(page: Page, start: string, count: number): Promise<string[]> {
  await page.getByRole("checkbox", { name: start }).focus();
  const visited: string[] = [];
  for (let i = 0; i < count; i++) {
    visited.push(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "<unnamed>"),
    );
    await page.keyboard.press("Tab");
  }
  return visited;
}
