import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";
import { tabOrder } from "./tab-order";
import { mockContext, mockQueue, pendingItem } from "./unknown-items-mocks";

/**
 * RT-771 (UX-10 "Selection ≠ Navigation"): the Unknown-items pending queue is
 * the first screen to render the shared DataTable selection mode, so the
 * browser checks RT-756 kept on a harness page (data-table-selection.spec.ts)
 * now run on the real screen: the keyboard order, that the checkbox never opens
 * the row, that the «Open» button does, axe with and without a selection
 * (forced-colors on and off), and the size of the selection cells, which no CI
 * run measured before a screen rendered them (RT-757's 36px floor). Runs once
 * per locale (RT-399); copy comes from the catalog (`t`). Mocked DP2.
 */

const ITEMS = [
  pendingItem(),
  pendingItem({ id: "u2", identifier_value: "5012345678917" }),
  pendingItem({ id: "u3", identifier_value: "5012345678924" }),
];
const VALUES = ITEMS.map((i) => i.identifier_value as string);

/** The selection cells must stay a 36px+ target in both dimensions (RT-757). */
const MIN_CELL = 36;

async function openQueue(page: Page): Promise<void> {
  await mockContext(page);
  await mockQueue(page, ITEMS);
  await page.route("**/api/v1/catalog/unknown-items/u2", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ITEMS[1]) }),
  );
  await page.goto("/unknown-items");
  await expect(page.getByRole("table")).toBeVisible();
}

test("RT-771: Tab visits the page checkbox, then each row's checkbox and open button, never the row", async ({
  page,
  t,
}) => {
  await openQueue(page);
  const expected = [
    t("table.selection.selectPage"),
    ...VALUES.flatMap((value) => [
      t("table.selection.selectRow", { value }),
      t("table.selection.openRow", { value }),
    ]),
  ];
  const visited = await tabOrder(page, t("table.selection.selectPage"), expected.length);
  expect(visited).toEqual(expected);
  expect(await page.locator("tbody tr[tabindex]").count()).toBe(0);
});

test("RT-771: Space and Enter on a row checkbox select it and never open the row", async ({
  page,
  t,
}) => {
  await openQueue(page);
  const box = page.getByRole("checkbox", {
    name: t("table.selection.selectRow", { value: VALUES[1] as string }),
  });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await expect(page.getByText(t("table.selection.pageCount", { count: 1 }))).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("RT-771: clicking the row or its checkbox cell opens nothing; the open button opens that item", async ({
  page,
  t,
}) => {
  await openQueue(page);
  await page.getByRole("cell", { name: VALUES[2] as string, exact: true }).click();
  await page
    .locator("tbody tr")
    .nth(2)
    .locator("td.data-table__select")
    .click({
      position: { x: 2, y: 2 },
    });
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const open = page.getByRole("button", {
    name: t("table.selection.openRow", { value: VALUES[1] as string }),
  });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: t("unknownItems.drawer.title") })).toBeVisible();
});

test("RT-771: the selection cells are a 36px+ target in both dimensions", async ({
  page,
}, testInfo) => {
  await openQueue(page);
  const header = await page.locator("thead th.data-table__select").boundingBox();
  const cell = await page
    .locator("tbody tr")
    .first()
    .locator("td.data-table__select")
    .boundingBox();
  expect(header, "header selection cell").not.toBeNull();
  expect(cell, "row selection cell").not.toBeNull();
  for (const box of [header, cell]) {
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_CELL);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_CELL);
  }
  testInfo.annotations.push({
    type: "selection-cell-size",
    description: `header ${header?.width}x${header?.height}; row ${cell?.width}x${cell?.height}`,
  });
});

test("RT-771: changing the sort empties the selection", async ({ page, t }) => {
  await openQueue(page);
  await page.getByRole("checkbox", { name: t("table.selection.selectPage") }).check();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(VALUES.length + 1);
  await page.getByLabel(t("unknownItems.filters.sort")).selectOption("age_asc");
  await expect(page.getByRole("checkbox", { name: t("table.selection.selectPage") })).toBeVisible();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
});

for (const forced of [false, true]) {
  test(`RT-771: no axe violations with and without a selection (forced-colors ${forced})`, async ({
    page,
    t,
  }) => {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    await openQueue(page);
    await expectNoAxeViolations(page, `unknown items, nothing selected (forced ${forced})`);

    await page.getByRole("checkbox", { name: t("table.selection.selectPage") }).check();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(VALUES.length + 1);
    await expectNoAxeViolations(page, `unknown items, page selected (forced ${forced})`);
  });
}
