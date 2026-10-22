import { expectNoAxeViolations } from "./axe";
import { expect, test } from "./fixtures";
import { type BuiltHarness, HARNESS_BASE, buildHarness } from "./harness/build";

/**
 * RT-756 (UX-10 "Selection ≠ Navigation"): the shared DataTable in selection
 * mode, on a harness page because no screen adopts selection yet (RT-771 is the
 * first; move these checks onto its screen when it lands). The unit tests pin
 * the DOM contract; this proves it in a real browser: the keyboard order, that
 * Enter/Space on the checkbox never opens the row, that the open control does,
 * and that the page stays free of WCAG 2.1 A/AA axe violations, forced-colors
 * included. Runs once per locale (RT-399); copy comes from the catalog (`t`).
 */

const PAGE = `${HARNESS_BASE}data-table-selection.html`;
const ROW_NAMES = ["Alpha", "Beta", "Gamma"];

let harness: BuiltHarness;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  harness = await buildHarness("data-table-selection.html");
});

test.afterAll(async () => {
  await harness?.dispose();
});

test.beforeEach(async ({ page }) => {
  await harness.serve(page);
  await page.goto(PAGE);
  await expect(page.getByRole("table")).toBeVisible();
});

test("RT-756: Tab visits the page checkbox, then each row's checkbox and open button, never the row", async ({
  page,
  t,
}) => {
  const expected = [
    t("table.selection.selectPage"),
    ...ROW_NAMES.flatMap((name) => [
      t("table.selection.selectRow", { value: name }),
      t("table.selection.openRow", { value: name }),
    ]),
  ];
  await page.getByRole("checkbox", { name: t("table.selection.selectPage") }).focus();
  const visited: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    visited.push(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "<unnamed>"),
    );
    await page.keyboard.press("Tab");
  }
  expect(visited).toEqual(expected);
  expect(await page.locator("tbody tr[tabindex]").count()).toBe(0);
});

test("RT-756: Enter and Space on a row checkbox never open the row", async ({ page, t }) => {
  const box = page.getByRole("checkbox", {
    name: t("table.selection.selectRow", { value: "Beta" }),
  });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Nothing opened");
});

test("RT-756: clicking the row opens nothing; the open button opens that row by keyboard", async ({
  page,
  t,
}) => {
  await page.getByRole("cell", { name: "Gamma", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nothing opened");

  const beta = page.getByRole("button", { name: t("table.selection.openRow", { value: "Beta" }) });
  await beta.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Opened: Beta");

  const alpha = page.getByRole("button", {
    name: t("table.selection.openRow", { value: "Alpha" }),
  });
  await alpha.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toHaveText("Opened: Alpha");
});

for (const forced of [false, true]) {
  test(`RT-756: no axe violations with and without a selection (forced-colors ${forced})`, async ({
    page,
    t,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await expectNoAxeViolations(page, `selection table, nothing selected (forced ${forced})`);

    await page.getByRole("checkbox", { name: t("table.selection.selectPage") }).check();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(ROW_NAMES.length + 1);
    await expectNoAxeViolations(page, `selection table, page selected (forced ${forced})`);
  });
}
