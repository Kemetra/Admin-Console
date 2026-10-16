import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SAVED_NAVIGATION } from "@/shell/dirty-guard";

const createStore = vi.fn();
const updateStore = vi.fn();
const readStore = vi.fn();
const previewStoreTimezoneChange = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    createStore: (...a: unknown[]) => createStore(...a),
    updateStore: (...a: unknown[]) => updateStore(...a),
    readStore: (...a: unknown[]) => readStore(...a),
    previewStoreTimezoneChange: (...a: unknown[]) => previewStoreTimezoneChange(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreForm } from "@/stores/StoreForm";
import { StoreFormRoute } from "@/stores/StoreFormRoute";

function renderForm(props: Parameters<typeof StoreForm>[0]): void {
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
      <StoreForm {...props} />
    </Tree>,
  );
}

const withTenant = { context: { active_tenant: { id: "t1", name: "Northstar Retail" } } };
const cfc = {
  code: "CFC",
  name: "Cairo Festival City",
  is_active: true,
  timezone: "UTC",
};

const impact = (over: Record<string, unknown> = {}) => ({
  store_id: "s1",
  current_timezone: "UTC",
  proposed_timezone: "Africa/Cairo",
  no_op: false,
  now: "2026-10-16T22:30:00Z",
  utc_offset_minutes_current: 0,
  utc_offset_minutes_proposed: 180,
  business_date_current: "2026-10-16",
  business_date_proposed: "2026-10-17",
  business_date_changes_now: true,
  open_shift_count: 0,
  blockers: [],
  ...over,
});
const tzSelect = () => screen.getByRole("combobox") as HTMLSelectElement;
const chooseZone = (zone: string) => fireEvent.change(tzSelect(), { target: { value: zone } });
const saveButton = () => screen.getByRole("button", { name: "Save store" }) as HTMLButtonElement;
const reviewBox = () => screen.getByRole("checkbox", { name: /reviewed this impact/i });
const previewShown = () => screen.findByText(/business date changes from/i);
const changeAndReview = async () => {
  chooseZone("Africa/Cairo");
  await previewShown();
  fireEvent.click(reviewBox());
};

/**
 * RT-477 create form (screen 16): the time zone is REQUIRED in the UI with
 * Africa/Cairo preselected, and validated as an IanaTimezone. A UI rule only:
 * the contract keeps `timezone` optional with a UTC default (comment 12083).
 */
describe("StoreForm create: time zone", () => {
  beforeEach(() => {
    createStore.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
    setLocale("en");
  });

  test("Africa/Cairo is preselected and the field is required", () => {
    renderForm({ mode: "create" });
    const select = tzSelect();
    expect(select.value).toBe("Africa/Cairo");
    expect(select.getAttribute("aria-required")).toBe("true");
    expect(screen.getByLabelText("Time zone (required)")).toBe(select);
    expect(select.selectedOptions[0]?.textContent).toBe("Cairo (Africa/Cairo)");
  });

  test("the default is sent when the user changes nothing", async () => {
    createStore.mockResolvedValue({ status: 201, data: { id: "s9" } });
    renderForm({ mode: "create" });
    fireEvent.change(screen.getByLabelText(/store code/i), { target: { value: "CFC" } });
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: "Cairo FC" } });
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
    await waitFor(() => expect(createStore).toHaveBeenCalledTimes(1));
    expect(createStore).toHaveBeenCalledWith({
      code: "CFC",
      name: "Cairo FC",
      timezone: "Africa/Cairo",
    });
  });

  test("a chosen zone is what is sent", async () => {
    createStore.mockResolvedValue({ status: 201, data: { id: "s9" } });
    renderForm({ mode: "create" });
    chooseZone("Asia/Riyadh");
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
    await waitFor(() => expect(createStore).toHaveBeenCalledTimes(1));
    expect(createStore.mock.calls[0]?.[0]).toMatchObject({ timezone: "Asia/Riyadh" });
  });

  test("an empty value is refused inline and nothing is sent", async () => {
    renderForm({ mode: "create" });
    chooseZone("");
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
    expect(await screen.findByText("Choose a valid time zone from the list.")).toBeDefined();
    expect(tzSelect().getAttribute("aria-invalid")).toBe("true");
    expect(createStore).not.toHaveBeenCalled();
  });

  test("400 invalid_timezone -> inline on the time zone field, no banner", async () => {
    createStore.mockResolvedValue({
      status: 400,
      error: { error: { code: "invalid_timezone", request_id: "req-tz1" } },
    });
    renderForm({ mode: "create" });
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
    expect(await screen.findByText("Choose a valid time zone from the list.")).toBeDefined();
    expect(tzSelect().getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector(".rtc-alert")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("a store-code 409 is still the inline code conflict", async () => {
    createStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "store_code_conflict", request_id: "r1" } },
    });
    renderForm({ mode: "create" });
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
    expect(await screen.findByText(/store code is already in use/i)).toBeDefined();
  });
});

/**
 * RT-477 edit form (screen 17): a zone change is previewed first
 * (`GET .../timezone-change-preview`), the impact shown, the user confirms, and
 * only then does `PATCH` carry `timezone`, `expected_current_timezone` and
 * `timezone_impact_reviewed: true` together. An unchanged zone is never sent.
 */
describe("StoreForm edit: changing the time zone", () => {
  beforeEach(() => {
    updateStore.mockReset();
    previewStoreTimezoneChange.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
    setLocale("en");
    previewStoreTimezoneChange.mockResolvedValue({ status: 200, data: impact() });
  });

  test("shows the store's current zone, selected, with no preview", () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    expect(tzSelect().value).toBe("UTC");
    expect(screen.getByLabelText("Time zone")).toBe(tzSelect());
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(previewStoreTimezoneChange).not.toHaveBeenCalled();
  });

  test("a zone outside the lists is still an option and is not a change", async () => {
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({
      mode: "edit",
      storeId: "s1",
      initial: { ...cfc, timezone: "Antarctica/Troll" },
    });
    expect(tzSelect().value).toBe("Antarctica/Troll");
    expect(previewStoreTimezoneChange).not.toHaveBeenCalled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateStore).toHaveBeenCalledWith("s1", { name: cfc.name }));
  });

  test("choosing a zone previews the impact and holds the save until it is reviewed", async () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    await previewShown();
    expect(previewStoreTimezoneChange).toHaveBeenCalledWith({
      storeId: "s1",
      timezone: "Africa/Cairo",
    });
    const region = screen.getByRole("region", { name: "Impact of the change" });
    expect(region.textContent).toContain("2026-10-16");
    expect(region.textContent).toContain("2026-10-17");
    expect(region.textContent).toContain("No open shifts");
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(reviewBox());
    expect(saveButton().disabled).toBe(false);
  });

  test("reviewed -> PATCH carries timezone, expected_current_timezone and timezone_impact_reviewed together", async () => {
    updateStore.mockResolvedValue({
      status: 200,
      data: { ...cfc, id: "s1", timezone: "Africa/Cairo" },
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/stores/s1", { state: SAVED_NAVIGATION }),
    );
    expect(updateStore).toHaveBeenCalledWith("s1", {
      name: "Cairo Festival City",
      timezone: "Africa/Cairo",
      expected_current_timezone: "UTC",
      timezone_impact_reviewed: true,
    });
  });

  test("expected_current_timezone is the zone the preview was computed from", async () => {
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({ current_timezone: "Asia/Riyadh" }),
    });
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateStore).toHaveBeenCalledTimes(1));
    expect(updateStore.mock.calls[0]?.[1]).toMatchObject({
      expected_current_timezone: "Asia/Riyadh",
    });
  });

  test("choosing the current zone again discards the preview and the review", async () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    chooseZone("UTC");
    expect(screen.queryByRole("region", { name: "Impact of the change" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    chooseZone("Africa/Cairo");
    await previewShown();
    expect((reviewBox() as HTMLInputElement).checked).toBe(false);
  });

  test("a date that does not change is said so", async () => {
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({ business_date_changes_now: false, business_date_proposed: "2026-10-16" }),
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByText(/business date stays 2026-10-16/i)).toBeDefined();
  });

  test("an open shift blocks the change: warning shown, nothing to confirm, save held", async () => {
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({
        open_shift_count: 2,
        blockers: [{ code: "store_has_open_shift", count: 2 }],
      }),
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByText(/2 shifts are open at this store/i)).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(saveButton().disabled).toBe(true);
    expect(updateStore).not.toHaveBeenCalled();
  });

  test("a preview that says no change sends the name only", async () => {
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({ no_op: true, current_timezone: "Africa/Cairo" }),
    });
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByText(/already this store's time zone/i)).toBeDefined();
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateStore).toHaveBeenCalledWith("s1", { name: cfc.name }));
  });

  test("a failed preview is shown and the zone cannot be applied", async () => {
    previewStoreTimezoneChange.mockResolvedValue({
      status: 400,
      error: { error: { code: "invalid_timezone", request_id: "req-p1" } },
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByText("Choose a valid time zone from the list.")).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  test("a thrown preview (offline) is a visible failure and holds the save", async () => {
    previewStoreTimezoneChange.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByText("The request could not be completed.")).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  test("409 timezone_changed_concurrently -> banner with request_id, review reset, no route change", async () => {
    updateStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "timezone_changed_concurrently", request_id: "req-409a" } },
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    fireEvent.click(saveButton());
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("rtc-alert--danger");
    expect(alert.textContent).toContain("changed by someone else");
    expect(alert.textContent).toContain("req-409a");
    await waitFor(() => expect((reviewBox() as HTMLInputElement).checked).toBe(false));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/store code is already in use/i)).toBeNull();
  });

  test("409 store_has_open_shift -> banner with request_id, no route change", async () => {
    updateStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "store_has_open_shift", request_id: "req-409b" } },
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    fireEvent.click(saveButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("open shift");
    expect(alert.textContent).toContain("req-409b");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/store code is already in use/i)).toBeNull();
  });

  test("400 invalid_timezone on save -> inline on the time zone field", async () => {
    updateStore.mockResolvedValue({
      status: 400,
      error: { error: { code: "invalid_timezone", request_id: "req-400t" } },
    });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    await changeAndReview();
    fireEvent.click(saveButton());
    await waitFor(() => expect(tzSelect().getAttribute("aria-invalid")).toBe("true"));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("StoreFormRoute edit: a concurrent time zone change", () => {
  test("refetches the store so the next preview starts from the current zone", async () => {
    setLocale("en");
    activeContext.mockReturnValue(withTenant);
    readStore.mockReset();
    updateStore.mockReset();
    previewStoreTimezoneChange.mockReset();
    readStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1" } });
    previewStoreTimezoneChange.mockResolvedValue({ status: 200, data: impact() });
    updateStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "timezone_changed_concurrently", request_id: "req-c" } },
    });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/stores/s1/edit"]}>
          <Routes>
            <Route path="/stores/:storeId/edit" element={<StoreFormRoute mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Save store" });
    expect(tzSelect().value).toBe("UTC");
    await changeAndReview();
    readStore.mockResolvedValue({
      status: 200,
      data: { ...cfc, id: "s1", timezone: "Asia/Riyadh" },
    });
    fireEvent.click(saveButton());
    await screen.findByText(/changed by someone else/i);
    await waitFor(() => expect(readStore).toHaveBeenCalledTimes(2));
  });
});

describe("StoreFormRoute edit: a stale review", () => {
  function renderRoute() {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/stores/s1/edit"]}>
          <Routes>
            <Route path="/stores/:storeId/edit" element={<StoreFormRoute mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return qc;
  }

  beforeEach(() => {
    setLocale("en");
    activeContext.mockReturnValue(withTenant);
    readStore.mockReset();
    updateStore.mockReset();
    previewStoreTimezoneChange.mockReset();
    readStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1" } });
  });

  test("a store_has_open_shift rejection re-previews: the blocker shows and the review is gone", async () => {
    previewStoreTimezoneChange.mockResolvedValueOnce({ status: 200, data: impact() });
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({
        now: "2026-10-16T22:31:00Z",
        open_shift_count: 1,
        blockers: [{ code: "store_has_open_shift", count: 1 }],
      }),
    });
    updateStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "store_has_open_shift", request_id: "req-os" } },
    });
    renderRoute();
    await screen.findByRole("button", { name: "Save store" });
    await changeAndReview();
    fireEvent.click(saveButton());
    expect(await screen.findByText(/1 shift is open at this store/i)).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(saveButton().disabled).toBe(true);
    expect(updateStore).toHaveBeenCalledTimes(1);
  });

  test("a refetched preview must be reviewed again", async () => {
    previewStoreTimezoneChange.mockResolvedValueOnce({ status: 200, data: impact() });
    previewStoreTimezoneChange.mockResolvedValue({
      status: 200,
      data: impact({
        now: "2026-10-16T22:45:00Z",
        business_date_changes_now: false,
        business_date_proposed: "2026-10-16",
      }),
    });
    updateStore.mockResolvedValue({
      status: 409,
      error: { error: { code: "timezone_changed_concurrently", request_id: "req-cc" } },
    });
    renderRoute();
    await screen.findByRole("button", { name: "Save store" });
    await changeAndReview();
    readStore.mockResolvedValue({
      status: 200,
      data: { ...cfc, id: "s1", timezone: "Asia/Riyadh" },
    });
    fireEvent.click(saveButton());
    await screen.findByText(/changed by someone else/i);
    // the fresh preview is shown, unreviewed, and the next PATCH is built from it
    await screen.findByText(/business date stays 2026-10-16/i);
    expect((reviewBox() as HTMLInputElement).checked).toBe(false);
    expect(saveButton().disabled).toBe(true);
  });

  test("an untouched select follows a store re-read with a new zone, and shows no change", async () => {
    const qc = renderRoute();
    await screen.findByRole("button", { name: "Save store" });
    expect(tzSelect().value).toBe("UTC");
    readStore.mockResolvedValue({
      status: 200,
      data: { ...cfc, id: "s1", timezone: "Asia/Riyadh" },
    });
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["rf2", "store", "s1"] });
    });
    await waitFor(() => expect(tzSelect().value).toBe("Asia/Riyadh"));
    expect(screen.queryByRole("region", { name: "Impact of the change" })).toBeNull();
    expect(previewStoreTimezoneChange).not.toHaveBeenCalled();
  });
});

describe("StoreForm Arabic: time zone", () => {
  beforeEach(() => {
    createStore.mockReset();
    updateStore.mockReset();
    previewStoreTimezoneChange.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
    setLocale("ar");
    previewStoreTimezoneChange.mockResolvedValue({ status: 200, data: impact() });
  });

  const arReview = () => screen.findByRole("checkbox", { name: /راجعتُ هذا الأثر/ });
  const arSave = () => screen.getByRole("button", { name: "حفظ المتجر" });

  test("create: «المنطقة الزمنية (إلزامي)» with «القاهرة (Africa/Cairo)» preselected", () => {
    renderForm({ mode: "create" });
    const select = screen.getByLabelText("المنطقة الزمنية (إلزامي)") as HTMLSelectElement;
    expect(select.value).toBe("Africa/Cairo");
    expect(select.selectedOptions[0]?.textContent).toBe("القاهرة (Africa/Cairo)");
  });

  test("create: an invalid zone is refused in Arabic and nothing is sent", async () => {
    renderForm({ mode: "create" });
    chooseZone("");
    fireEvent.click(screen.getByRole("button", { name: "إنشاء المتجر" }));
    expect(await screen.findByText("اختر منطقة زمنية صالحة من القائمة.")).toBeDefined();
    expect(createStore).not.toHaveBeenCalled();
  });

  test("edit: the impact panel and the review box follow the Arabic copy", async () => {
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    expect(await screen.findByRole("region", { name: "أثر التغيير" })).toBeDefined();
    fireEvent.click(await arReview());
    fireEvent.click(arSave());
    await waitFor(() => expect(updateStore).toHaveBeenCalledTimes(1));
  });

  test("edit: the store_has_open_shift and timezone_changed_concurrently banners in Arabic", async () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    chooseZone("Africa/Cairo");
    await screen.findByRole("region", { name: "أثر التغيير" });
    fireEvent.click(await arReview());
    updateStore.mockResolvedValueOnce({
      status: 409,
      error: { error: { code: "store_has_open_shift", request_id: "req-ar1" } },
    });
    fireEvent.click(arSave());
    const open = await screen.findByRole("alert");
    expect(open.textContent).toContain("وردية مفتوحة");
    expect(open.textContent).toContain("req-ar1");
    // The preview the review was for is stale: it must be reviewed again.
    expect(((await arReview()) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(await arReview());

    updateStore.mockResolvedValueOnce({
      status: 409,
      error: { error: { code: "timezone_changed_concurrently", request_id: "req-ar2" } },
    });
    fireEvent.click(arSave());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("req-ar2"));
    expect(screen.getByRole("alert").textContent).toContain("غيّر");
  });
});
