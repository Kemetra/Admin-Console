import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Drawer } from "@/components/Drawer";

function renderDrawer(onClose: () => void) {
  return render(
    <Drawer title="Details" onClose={onClose}>
      <button type="button">Inside</button>
    </Drawer>,
  );
}

describe("Drawer", () => {
  test("is a labelled native dialog", () => {
    renderDrawer(vi.fn());
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  test("a click on the scrim closes", () => {
    const onClose = vi.fn();
    const { container } = renderDrawer(onClose);
    const scrim = container.querySelector(".drawer-scrim");
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a click inside the panel does not close", () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    fireEvent.click(screen.getByRole("dialog", { name: "Details" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Escape closes", () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Details" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
