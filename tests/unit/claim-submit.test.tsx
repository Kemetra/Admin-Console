import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleSubmitClaim = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, consoleSubmitClaim: (...a: unknown[]) => consoleSubmitClaim(...a) };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { SubmitClaim } from "@/receivables/SubmitClaim";

function renderSubmit(
  onSubmitted = vi.fn(),
  receivableRefs: string[] = ["r1", "r2"],
): { onSubmitted: typeof onSubmitted } {
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
      <SubmitClaim
        activeTenant={{ id: "t1", name: "Northstar Retail" }}
        payerRef="p1"
        receivableRefs={receivableRefs}
        onClose={vi.fn()}
        onSubmitted={onSubmitted}
      />
    </Tree>,
  );
  return { onSubmitted };
}

function result(status: number, code?: string) {
  return {
    status,
    data: status === 201 ? { claimRef: "c1", status: "submitted" } : undefined,
    error: code ? { error: { code, request_id: "req-x" } } : undefined,
    headers: new Headers(),
  };
}

/**
 * 018 SubmitClaim drawer (VG-1). Submits a claim (payerRef + the selected
 * receivableRefs) with a per-submit Idempotency-Key; routes the outcome:
 * 201→onSubmitted; 400→inline; 403→banner; 409→non-disclosing. Mirrors 017's
 * PayerCreate.
 */
describe("SubmitClaim", () => {
  beforeEach(() => consoleSubmitClaim.mockReset());

  test("no receivables selected -> client validation, wrapper NOT called", async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SubmitClaim
            activeTenant={{ id: "t1", name: "Northstar Retail" }}
            payerRef="p1"
            receivableRefs={[]}
            onClose={vi.fn()}
            onSubmitted={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /submit claim/i }));
    expect(await screen.findByText(/at least one receivable/i)).toBeDefined();
    expect(consoleSubmitClaim).not.toHaveBeenCalled();
  });

  test("201 -> onSubmitted(claimRef); sends an Idempotency-Key", async () => {
    consoleSubmitClaim.mockResolvedValue(result(201));
    const { onSubmitted } = renderSubmit();
    fireEvent.click(screen.getByRole("button", { name: /submit claim/i }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    // onSubmitted receives the new claimRef so the caller can offer reconcile.
    expect(onSubmitted).toHaveBeenCalledWith("c1");
    const [, key] = consoleSubmitClaim.mock.calls[0];
    expect(String(key)).toMatch(/^[\x21-\x7E]{16,128}$/);
  });

  test("403 -> permission banner", async () => {
    consoleSubmitClaim.mockResolvedValue(result(403));
    renderSubmit();
    fireEvent.click(screen.getByRole("button", { name: /submit claim/i }));
    await waitFor(() => expect(screen.getByText(/permission/i)).toBeDefined());
  });

  test("409 -> non-disclosing conflict banner", async () => {
    consoleSubmitClaim.mockResolvedValue(result(409));
    renderSubmit();
    fireEvent.click(screen.getByRole("button", { name: /submit claim/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText("That claim could not be submitted. Please try again.")).toBeDefined();
  });

  test("scope line pluralizes the receivable count as a whole sentence", () => {
    const line = (refs: string[]) => {
      const { unmount } = render(
        <QueryClientProvider client={createQueryClient()}>
          <SubmitClaim
            activeTenant={{ id: "t1", name: "Northstar Retail" }}
            payerRef="p1"
            receivableRefs={refs}
            onClose={vi.fn()}
            onSubmitted={vi.fn()}
          />
        </QueryClientProvider>,
      );
      const text = document.querySelector(".surface__scope-line")?.textContent;
      unmount();
      return text;
    };
    expect(line(["r1"])).toBe("Submitting a claim for 1 receivable in Northstar Retail.");
    expect(line(["r1", "r2"])).toBe("Submitting a claim for 2 receivables in Northstar Retail.");
  });

  test("Arabic: title, plural scope line and actions render in Arabic only", async () => {
    setLocale("ar");
    consoleSubmitClaim.mockResolvedValue(result(403));
    renderSubmit();
    expect(screen.getByRole("heading", { name: "تقديم مطالبة" })).toBeDefined();
    expect(document.querySelector(".surface__scope-line")?.textContent).toBe(
      "تقديم مطالبة تشمل ذمتين مدينتين في Northstar Retail.",
    );
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "تقديم مطالبة" }));
    expect(
      await screen.findByText("ليست لديك صلاحية لتقديم مطالبات في هذه المؤسسة."),
    ).toBeDefined();
    expect(screen.queryByText(/submit claim/i)).toBeNull();
    expect(screen.queryByText(/permission/i)).toBeNull();
  });

  test("Arabic: a few receivables use the «few» plural form with Western digits", () => {
    setLocale("ar");
    renderSubmit(vi.fn(), ["r1", "r2", "r3"]);
    expect(document.querySelector(".surface__scope-line")?.textContent).toBe(
      "تقديم مطالبة تشمل 3 ذمم مدينة في Northstar Retail.",
    );
  });
});
