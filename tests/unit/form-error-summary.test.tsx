import { FormErrorSummary, useSummaryFocus } from "@/components/FormErrorSummary";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

/**
 * RT-768 (RT-752 D7): the shared error summary of a full-page form. Summary at
 * the top, focused after a blocked submit, one link per field error in field
 * order that focuses the field. It never navigates (a bare hash link would push
 * a history entry and could trip the unsaved-work guard, RT-268).
 */

function Harness({
  entries,
}: Readonly<{ entries: { fieldId: string; message: string }[] }>): React.JSX.Element {
  const { ref, focusSummary } = useSummaryFocus();
  return (
    <MemoryRouter>
      <button type="button" onClick={focusSummary}>
        blocked submit
      </button>
      <FormErrorSummary ref={ref} entries={entries} />
      <input id="f-name" aria-label="Name" />
      <input id="f-tax" aria-label="Tax" />
    </MemoryRouter>
  );
}

const TWO = [
  { fieldId: "f-name", message: "Enter the item name." },
  { fieldId: "f-tax", message: "Enter the tax category." },
];

describe("FormErrorSummary (RT-768, D7)", () => {
  test("renders nothing when there is no error", () => {
    render(<Harness entries={[]} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  test("a labelled region with a heading that counts the problems", () => {
    render(<Harness entries={TWO} />);
    const region = screen.getByRole("region", { name: "2 problems need fixing" });
    expect(within(region).getByRole("heading", { name: "2 problems need fixing" })).toBeDefined();
  });

  test("the heading is singular for one problem", () => {
    render(<Harness entries={[TWO[0]]} />);
    expect(screen.getByRole("region", { name: "1 problem needs fixing" })).toBeDefined();
  });

  test("one link per error, in the order given, each pointing at its field", () => {
    render(<Harness entries={TWO} />);
    const links = within(screen.getByRole("region")).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Enter the item name.",
      "Enter the tax category.",
    ]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#f-name", "#f-tax"]);
  });

  test("a link focuses its field and does not navigate", () => {
    render(<Harness entries={TWO} />);
    const link = screen.getByRole("link", { name: "Enter the tax category." });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false); // preventDefault was called: no hash navigation
    expect(document.activeElement).toBe(document.getElementById("f-tax"));
  });

  test("focusSummary moves focus to the summary, every time it is called", () => {
    render(<Harness entries={TWO} />);
    const region = screen.getByRole("region");
    expect(region.getAttribute("tabindex")).toBe("-1");
    const trigger = screen.getByRole("button", { name: "blocked submit" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(region);
    (document.getElementById("f-name") as HTMLElement).focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(region);
  });
});
