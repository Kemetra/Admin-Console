import { AuditInspectDrawer } from "@/audit/AuditInspectDrawer";
import type { AuditRow } from "@/audit/useAuditSearch";
import { setLocale } from "@/i18n/locale";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const row: AuditRow = {
  id: "e1",
  occurred_at: "2026-06-01T09:30:00Z",
  action: "shift.forced_close",
  actor_user_id: "u2",
  actor_label: "Omar Khaled",
  store_id: "s1",
  target_type: "shift",
  target_id: "sh-9",
  request_id: "11111111-1111-1111-1111-111111111111",
  metadata: { reason: "till_discrepancy", amount: 42 },
};

/**
 * Row inspect drawer (T024, VG-1, OQ-2). Reads the already-fetched row — no new
 * fetch — and renders all fields incl. metadata. Read-only: no action buttons.
 * request_id copy uses navigator.clipboard (mocked; undefined in jsdom).
 */
describe("AuditInspectDrawer", () => {
  test("renders all fields from the passed-in row incl. metadata; no fetch", () => {
    render(<AuditInspectDrawer row={row} onClose={vi.fn()} />);
    expect(screen.getByText("shift.forced_close")).toBeDefined();
    expect(screen.getByText("Omar Khaled")).toBeDefined();
    expect(screen.getByText(/shift · sh-9/)).toBeDefined();
    expect(screen.getByText("11111111-1111-1111-1111-111111111111")).toBeDefined();
    // metadata rendered
    expect(screen.getByText("reason")).toBeDefined();
    expect(screen.getByText(/till_discrepancy/)).toBeDefined();
  });

  test("read-only: no acknowledge/annotate/export/save buttons (only Copy + Close)", () => {
    render(<AuditInspectDrawer row={row} onClose={vi.fn()} />);
    const buttons = screen.getAllByRole("button").map((b) => b.textContent?.toLowerCase() ?? "");
    expect(buttons.some((t) => /acknowledge|annotate|export|save|delete|revoke/.test(t))).toBe(
      false,
    );
  });

  test("copy request_id calls clipboard (mocked)", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AuditInspectDrawer row={row} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  test("RT-399: occurred_at is exact UTC evidence, labelled UTC, LTR-isolated", () => {
    render(<AuditInspectDrawer row={row} onClose={vi.fn()} />);
    expect(screen.getByText("Time (UTC)")).toBeDefined();
    const time = screen.getByText("2026-06-01 09:30:00 UTC");
    expect(time.tagName).toBe("BDI");
    expect(time.getAttribute("dir")).toBe("ltr");
    // Machine data stays verbatim and LTR-isolated.
    for (const machine of ["shift.forced_close", "11111111-1111-1111-1111-111111111111", "s1"]) {
      expect(screen.getByText(machine).closest("bdi")?.getAttribute("dir")).toBe("ltr");
    }
  });

  test("RT-399: Arabic renders the drawer chrome in Arabic; machine data unchanged", () => {
    setLocale("ar");
    render(<AuditInspectDrawer row={row} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "حدث التدقيق" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "حدث التدقيق" })).toBeDefined();
    expect(screen.getByText("الوقت (UTC)")).toBeDefined();
    expect(screen.getByText("مرجع الطلب")).toBeDefined();
    expect(screen.getByRole("heading", { name: "البيانات الوصفية" })).toBeDefined();
    expect(screen.getByRole("button", { name: "نسخ" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
    expect(screen.queryByText("Audit event")).toBeNull();
    expect(screen.queryByText("Metadata")).toBeNull();
    // Action codes, IDs and the evidence time are not translated.
    expect(screen.getByText("shift.forced_close")).toBeDefined();
    expect(screen.getByText("2026-06-01 09:30:00 UTC")).toBeDefined();
    expect(screen.getByText("11111111-1111-1111-1111-111111111111")).toBeDefined();
  });

  test("RT-399: Arabic empty metadata copy", () => {
    setLocale("ar");
    render(<AuditInspectDrawer row={{ ...row, metadata: {} }} onClose={vi.fn()} />);
    expect(screen.getByText("لا توجد بيانات وصفية.")).toBeDefined();
  });

  test("Escape closes the drawer", () => {
    const onClose = vi.fn();
    render(<AuditInspectDrawer row={row} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
