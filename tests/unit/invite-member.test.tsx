import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createInvitation = vi.fn();
const refreshSession = vi.fn(async () => ({ status: 200 }));
const signOut = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    createInvitation: (...a: unknown[]) => createInvitation(...a),
    refreshSession: () => refreshSession(),
  };
});
vi.mock("@/shell/useSignOut", () => ({ useSignOut: () => signOut }));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { InviteMember } from "@/operators/InviteMember";

function renderInvite(onInvited = vi.fn()): { onInvited: typeof onInvited } {
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(
    <Tree>
      <InviteMember
        activeTenant={{ id: "t1", name: "Northstar Retail" }}
        onClose={vi.fn()}
        onInvited={onInvited}
      />
    </Tree>,
  );
  return { onInvited };
}

function fillAndSend(): void {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@northstar.eg" } });
  fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "store_staff" } });
  fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));
}

function result(status: number, code?: string, headers: Record<string, string> = {}) {
  return {
    status,
    data: undefined,
    error: code ? { error: { code, request_id: "req-x" } } : undefined,
    headers: new Headers(headers),
  };
}

/**
 * Invite drawer outcome rendering (T021, VG-1). The full status matrix the
 * design-brief SF5-2 specifies, exercising the InviteMember switch.
 */
describe("InviteMember outcomes", () => {
  beforeEach(() => {
    createInvitation.mockReset();
    refreshSession.mockClear();
    signOut.mockReset();
  });

  test("201 -> onInvited (close + refresh)", async () => {
    createInvitation.mockResolvedValue(result(201));
    const { onInvited } = renderInvite();
    fillAndSend();
    await waitFor(() => expect(onInvited).toHaveBeenCalledOnce());
  });

  test("403 -> permission banner with request_id", async () => {
    createInvitation.mockResolvedValue(result(403, "forbidden"));
    renderInvite();
    fillAndSend();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/do not have permission/i);
    expect(alert.textContent).toMatch(/req-x/);
  });

  test("409 pending -> distinct 'already pending' warning", async () => {
    createInvitation.mockResolvedValue(result(409, "pending_invitation"));
    renderInvite();
    fillAndSend();
    expect(await screen.findByText(/already pending for this email/i)).toBeDefined();
  });

  test("409 idempotency_key_conflict -> 'please try again' (terminal for this key)", async () => {
    createInvitation.mockResolvedValue(result(409, "idempotency_key_conflict"));
    renderInvite();
    fillAndSend();
    expect(await screen.findByText(/could not be completed/i)).toBeDefined();
  });

  test("400 validation_error -> inline field error", async () => {
    createInvitation.mockResolvedValue(result(400, "validation_error"));
    renderInvite();
    fillAndSend();
    expect(await screen.findByText(/check the invitation details/i)).toBeDefined();
  });

  test("400 idempotency_key_malformed -> silently regenerates key and resubmits", async () => {
    createInvitation
      .mockResolvedValueOnce(result(400, "idempotency_key_malformed"))
      .mockResolvedValueOnce(result(201));
    const { onInvited } = renderInvite();
    fillAndSend();
    await waitFor(() => expect(onInvited).toHaveBeenCalledOnce());
    // two attempts: malformed-key then a fresh key
    expect(createInvitation).toHaveBeenCalledTimes(2);
    // and the two calls used DIFFERENT keys (2nd arg)
    const k1 = createInvitation.mock.calls[0][1];
    const k2 = createInvitation.mock.calls[1][1];
    expect(k1).not.toBe(k2);
  });

  test("precondition 401 (refresh ok, retry still 401) -> scope warning, NOT sign-out", async () => {
    createInvitation.mockResolvedValue(result(401));
    refreshSession.mockResolvedValue({ status: 200 });
    renderInvite();
    fillAndSend();
    expect(await screen.findByText(/select a tenant before inviting/i)).toBeDefined();
    expect(signOut).not.toHaveBeenCalled();
  });

  test("session-expiry 401 (refresh fails) -> sign-out", async () => {
    createInvitation.mockResolvedValue(result(401));
    refreshSession.mockResolvedValue({ status: 401 });
    renderInvite();
    fillAndSend();
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  test("425 -> disabled submit shows the countdown sentence, then retries with the SAME key", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      createInvitation
        .mockResolvedValueOnce(result(425, undefined, { "Retry-After": "3" }))
        .mockResolvedValueOnce(result(201));
      const { onInvited } = renderInvite();
      fillAndSend();
      const submit = await screen.findByRole("button", { name: "Retrying in 3s…" });
      expect((submit as HTMLButtonElement).disabled).toBe(true);
      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() => expect(onInvited).toHaveBeenCalledOnce());
      expect(createInvitation).toHaveBeenCalledTimes(2);
      expect(createInvitation.mock.calls[1][1]).toBe(createInvitation.mock.calls[0][1]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("InviteMember in Arabic", () => {
  beforeEach(() => {
    createInvitation.mockReset();
    refreshSession.mockClear();
    signOut.mockReset();
  });

  test("drawer, fields and primary action render in Arabic", () => {
    setLocale("ar");
    renderInvite();
    expect(screen.getByRole("dialog", { name: "دعوة مستخدم" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إرسال الدعوة" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeDefined();
    expect(screen.getByLabelText("الدور")).toBeDefined();
    expect(screen.getByText("كل المتاجر")).toBeDefined();
    expect(screen.getByText("متاجر محددة")).toBeDefined();
    // The tenant name stays as authored, isolated inside the Arabic sentence.
    expect(screen.getByText("Northstar Retail").tagName).toBe("BDI");
    for (const english of [/invite member/i, /send invitation/i, /^cancel$/i, /all stores/i]) {
      expect(screen.queryByText(english)).toBeNull();
    }
  });

  test("409 pending -> Arabic warning banner, request reference kept exact", async () => {
    setLocale("ar");
    createInvitation.mockResolvedValue(result(409, "pending_invitation"));
    renderInvite();
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), {
      target: { value: "new@northstar.eg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إرسال الدعوة" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("توجد دعوة معلّقة بالفعل لهذا البريد الإلكتروني.");
    expect(alert.textContent).toMatch(/req-x/);
    expect(alert.textContent).not.toMatch(/already pending/i);
  });

  test("425 -> the countdown is one Arabic sentence with the plural-correct count", async () => {
    setLocale("ar");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      createInvitation
        .mockResolvedValueOnce(result(425, undefined, { "Retry-After": "3" }))
        .mockResolvedValueOnce(result(201));
      const { onInvited } = renderInvite();
      fireEvent.click(screen.getByRole("button", { name: "إرسال الدعوة" }));
      expect(
        await screen.findByRole("button", { name: "إعادة المحاولة بعد 3 ثوانٍ…" }),
      ).toBeDefined();
      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() => expect(onInvited).toHaveBeenCalledOnce());
    } finally {
      vi.useRealTimers();
    }
  });
});
