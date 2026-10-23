import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Drawer } from "@/components/Drawer";

function renderDrawer(onClose: () => void, dismissible?: boolean) {
  return render(
    <Drawer title="Details" onClose={onClose} dismissible={dismissible}>
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

  test.each([
    ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["a scrim click", () => fireEvent.click(document.querySelector(".drawer-scrim") as Element)],
  ])("%s plays the exit before closing", (_label, trigger) => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    renderDrawer(onClose);
    trigger();
    expect(
      screen.getByRole("dialog", { name: "Details" }).classList.contains("drawer--closing"),
    ).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // PairDrawer / LifecycleFlow: while a pairing code is being issued nothing may
  // close the drawer, or the one-time code is lost.
  test("a busy (non-dismissible) drawer ignores every close request", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    const { container } = renderDrawer(onClose, false);
    const dialog = screen.getByRole("dialog", { name: "Details" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(container.querySelector(".drawer-scrim") as Element);
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.classList.contains("drawer--closing")).toBe(false);
    expect(dialog.hasAttribute("inert")).toBe(false);
  });

  test("a close requested while busy does not fire once the drawer becomes dismissible", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const onClose = vi.fn();
    const { rerender } = renderDrawer(onClose, false);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Details" }), { key: "Escape" });
    rerender(
      <Drawer title="Details" onClose={onClose} dismissible>
        <button type="button">Inside</button>
      </Drawer>,
    );
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a drawer its parent keeps open comes back usable after the exit", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--duration-2", "150ms");
    const keepOpen = vi.fn();
    renderDrawer(keepOpen);
    const dialog = screen.getByRole("dialog", { name: "Details" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(keepOpen).toHaveBeenCalledTimes(1);
    expect(dialog.classList.contains("drawer--closing")).toBe(false);
    expect(dialog.hasAttribute("inert")).toBe(false);
    // And it can be asked to close again.
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.classList.contains("drawer--closing")).toBe(true);
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

describe("Drawer side (RT-825)", () => {
  test("opens at the inline end by default", () => {
    const { container } = renderDrawer(vi.fn());
    expect(container.querySelector(".drawer-scrim--start")).toBeNull();
    expect(screen.getByRole("dialog").classList.contains("drawer--start")).toBe(false);
  });

  test("a start drawer opens at the inline start and carries its id", () => {
    const { container } = render(
      <Drawer title="Menu" onClose={vi.fn()} side="start" id="shell-menu">
        <button type="button">Inside</button>
      </Drawer>,
    );
    expect(container.querySelector(".drawer-scrim--start")).not.toBeNull();
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog.classList.contains("drawer--start")).toBe(true);
    expect(dialog.id).toBe("shell-menu");
  });
});
