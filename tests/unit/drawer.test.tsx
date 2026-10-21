import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

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

describe("Drawer exit", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty("--duration-2");
  });

  test("Escape plays the exit, then calls onClose once after --duration-2", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    const { container } = renderDrawer(onClose);
    const dialog = screen.getByRole("dialog", { name: "Details" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.classList.contains("drawer--closing")).toBe(true);
    expect(
      container.querySelector(".drawer-scrim")?.classList.contains("drawer-scrim--closing"),
    ).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    // A second Escape while closing is ignored.
    fireEvent.keyDown(dialog, { key: "Escape" });
    vi.advanceTimersByTime(149);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the close button and the scrim use the same exit", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    const { container } = renderDrawer(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getByRole("dialog", { name: "Details" }).classList.contains("drawer--closing"),
    ).toBe(true);
    fireEvent.click(container.querySelector(".drawer-scrim") as Element);
    vi.advanceTimersByTime(150);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("unmounting during the exit cancels the pending onClose", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    const { unmount } = renderDrawer(onClose);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Details" }), { key: "Escape" });
    unmount();
    vi.advanceTimersByTime(500);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("with no duration (or 0ms, reduced motion) Escape closes immediately", () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    const dialog = screen.getByRole("dialog", { name: "Details" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.classList.contains("drawer--closing")).toBe(false);

    document.documentElement.style.setProperty("--duration-2", "0ms");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
