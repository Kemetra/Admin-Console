import { setLocale } from "@/i18n/locale";
import { AppErrorBoundary } from "@/observability/AppErrorBoundary";
import { RouteErrorFallback } from "@/observability/RouteErrorFallback";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-633 (OBS-4): a top-level ErrorBoundary plus the data router's root
 * `errorElement` (a data router catches route render errors itself, so a
 * boundary around <App/> alone would never see them). Both report to Sentry
 * and render a safe fallback that never shows the error message.
 */
const captureException = vi.fn();
vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const SECRET = "boom a@b.test eyJhbGciOi.eyJzdWIiOiIx.c2ln";

function Thrower(): React.JSX.Element {
  throw new Error(SECRET);
}

beforeEach(() => {
  captureException.mockClear();
  // React logs caught render errors; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  test("renders its children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <p>ok</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeTruthy();
    expect(captureException).not.toHaveBeenCalled();
  });

  test("reports the error once and shows a fallback without its message", () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong");
    expect(alert.textContent).not.toContain("a@b.test");
    expect(alert.textContent).not.toContain("boom");
    expect(screen.getByRole("button", { name: "Reload the page" })).toBeTruthy();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect((captureException.mock.calls[0]?.[0] as Error).message).toBe(SECRET);
  });

  test("uses the Arabic copy in the Arabic locale", () => {
    setLocale("ar");
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("حدث خطأ غير متوقع");
    expect(screen.getByRole("button", { name: "إعادة تحميل الصفحة" })).toBeTruthy();
  });
});

describe("RouteErrorFallback", () => {
  test("reports a route render error and shows the safe fallback", async () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <Thrower />, errorElement: <RouteErrorFallback /> }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Something went wrong");
    expect(alert.textContent).not.toContain("a@b.test");
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
