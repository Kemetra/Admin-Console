import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/client", () => ({
  signIn: vi.fn(),
  acceptInvitation: vi.fn(),
  listMembers: vi.fn(),
  revokeMembership: vi.fn(),
  updateMembership: vi.fn(),
}));

import { AcceptInvitation } from "@/auth/AcceptInvitation";
import { NoAccess } from "@/auth/NoAccess";
import { SignIn } from "@/auth/SignIn";
import { setLocale } from "@/i18n/locale";
import * as client from "@/lib/client";
import { createQueryClient } from "@/lib/query";

function submitCredentials(): void {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("SignIn component", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders email + password fields and a sign-in button", () => {
    render(<SignIn onResolved={vi.fn()} />);
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
  });

  test("on 401, shows the generic error banner with request_id and does not resolve", async () => {
    vi.mocked(client.signIn).mockResolvedValue({
      status: 401,
      error: { error: { request_id: "req-401" } },
    } as never);
    const onResolved = vi.fn();
    render(<SignIn onResolved={onResolved} />);

    submitCredentials();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Sign-in failed.");
    expect(alert.textContent).toContain("req-401");
    expect(onResolved).not.toHaveBeenCalled();
  });

  test("on 429, shows the retry-after banner and a disabled retry button", async () => {
    vi.mocked(client.signIn).mockResolvedValue({
      status: 429,
      error: { error: { request_id: "req-429" } },
      retryAfterSeconds: 27,
    } as never);
    render(<SignIn onResolved={vi.fn()} />);

    submitCredentials();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Too many attempts. You can try again in 27s.");
    const retry = screen.getByRole("button", { name: "Try again in 27s" });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
  });

  test("on success with one membership, resolves to auto-select", async () => {
    vi.mocked(client.signIn).mockResolvedValue({
      status: 200,
      data: { memberships: [{ tenant_id: "t1" }] },
    } as never);
    const onResolved = vi.fn();
    render(<SignIn onResolved={onResolved} />);

    submitCredentials();

    await waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith({ kind: "auto-select", tenantId: "t1" }),
    );
  });

  test("keeps email and password input LTR (machine data, UX-11)", () => {
    render(<SignIn onResolved={vi.fn()} />);
    expect(screen.getByLabelText("Email").getAttribute("dir")).toBe("ltr");
    expect(screen.getByLabelText("Password").getAttribute("dir")).toBe("ltr");
  });
});

/**
 * RT-399: the auth surfaces in the Arabic product locale. Arabic copy only for
 * the translated elements (one locale at a time); the word mark stays the
 * Latin proper name, and the error kept in state is a key, so a locale switch
 * re-renders it.
 */
describe("auth surfaces in Arabic", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sign-in renders Arabic copy and no English for the same elements", () => {
    setLocale("ar");
    render(<SignIn onResolved={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("تسجيل الدخول");
    expect(screen.getByText("دخول المستخدمين إلى لوحة التحكم.")).toBeDefined();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeDefined();
    expect(screen.getByLabelText("كلمة المرور")).toBeDefined();
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeDefined();
    expect(screen.getByText("منصة محمية · يخضع كل نشاط للتدقيق")).toBeDefined();
    expect(screen.getByText("Retail Tower OS")).toBeDefined();

    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(screen.queryByText(/operator access/i)).toBeNull();
  });

  test("a failed sign-in shows the Arabic generic error with the request reference", async () => {
    setLocale("ar");
    vi.mocked(client.signIn).mockResolvedValue({
      status: 401,
      error: { error: { request_id: "req-401" } },
    } as never);
    render(<SignIn onResolved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "تعذّر تسجيل الدخول. تحقّق من البريد الإلكتروني وكلمة المرور، ثم حاول مرة أخرى.",
    );
    expect(alert.textContent).toContain("req-401");
    expect(alert.textContent).not.toContain("Sign-in failed");
  });

  test("rate-limited copy uses Arabic plural phrases with Western digits", async () => {
    setLocale("ar");
    vi.mocked(client.signIn).mockResolvedValue({ status: 429, retryAfterSeconds: 27 } as never);
    render(<SignIn onResolved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد 27 ثانية.");
    expect(screen.getByRole("button", { name: "حاول مرة أخرى بعد 27 ثانية" })).toBeDefined();
  });

  test("an error shown in English re-renders in Arabic on a locale switch", async () => {
    vi.mocked(client.signIn).mockResolvedValue({
      status: 401,
      error: { error: { request_id: "req-401" } },
    } as never);
    render(<SignIn onResolved={vi.fn()} />);

    submitCredentials();
    expect((await screen.findByRole("alert")).textContent).toContain("Sign-in failed.");

    act(() => setLocale("ar"));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("تعذّر تسجيل الدخول.");
    expect(alert.textContent).not.toContain("Sign-in failed");
  });

  test("no-access renders Arabic copy and an Arabic sign-out action", () => {
    setLocale("ar");
    const onSignOut = vi.fn();
    render(<NoAccess onSignOut={onSignOut} />);

    expect(screen.getByRole("heading", { name: "لا توجد صلاحية وصول مُسندة إليك" })).toBeDefined();
    expect(screen.getByText(/تواصل مع المسؤول لديك لمنحك عضوية\./)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.queryByText(/no assigned access/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  function renderAcceptInvitation(entry: string): void {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[entry]}>
          <AcceptInvitation />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  test("accept invitation renders the Arabic form and the sign-in path", () => {
    setLocale("ar");
    renderAcceptInvitation("/accept-invitation?token=valid-token");

    expect(screen.getByRole("heading", { name: "قبول دعوتك" })).toBeDefined();
    expect(screen.getByLabelText("الاسم المعروض")).toBeDefined();
    const password = screen.getByLabelText("كلمة المرور");
    expect(password.getAttribute("placeholder")).toBe("مطلوبة عند إنشاء حساب جديد");
    expect(screen.getByRole("button", { name: "قبول الدعوة" })).toBeDefined();
    expect(screen.getByText(/لديك صلاحية وصول بالفعل؟/)).toBeDefined();
    expect(screen.getByRole("link", { name: "تسجيل الدخول" }).getAttribute("href")).toBe("/signin");
    expect(screen.queryByRole("button", { name: /accept invitation/i })).toBeNull();
  });

  test("a rejected invitation token shows the Arabic invalid-link error", async () => {
    setLocale("ar");
    vi.mocked(client.acceptInvitation).mockResolvedValue({ status: 400 } as never);
    renderAcceptInvitation("/accept-invitation?token=bad");

    fireEvent.click(screen.getByRole("button", { name: "قبول الدعوة" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("رابط الدعوة هذا غير صالح أو انتهت صلاحيته.");
  });

  test("a missing invitation token shows the Arabic invalid state", () => {
    setLocale("ar");
    renderAcceptInvitation("/accept-invitation");

    expect(screen.getByRole("heading", { name: "الدعوة" })).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      "رابط الدعوة هذا غير صالح أو انتهت صلاحيته.",
    );
    expect(screen.getByRole("link", { name: "الانتقال إلى تسجيل الدخول" })).toBeDefined();
  });
});
