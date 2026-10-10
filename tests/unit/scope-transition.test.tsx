import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

vi.mock("@/shell/useSignOut", () => ({ useSignOut: () => vi.fn() }));

import { createQueryClient } from "@/lib/query";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { ScopeHeader } from "@/shell/ScopeHeader";
import { ScopeMismatchBanner } from "@/shell/ScopeMismatchBanner";
import { DirtyGuardProvider } from "@/shell/dirty-guard";

/**
 * RT-268 (UX-09): a scope change is a context transition. It asks before
 * dropping unsaved work, resets what belonged to the old scope, is announced to
 * screen readers, and is never triggered by a deep link on its own.
 */
const switchStore = vi.fn().mockResolvedValue(undefined);
const clearStore = vi.fn().mockResolvedValue(undefined);

const tenant = { id: "t1", name: "Northstar Retail" };
function value(activeStore: { id: string; name: string } | null) {
  return {
    switchStore,
    clearStore,
    isLoading: false,
    sessionLost: false,
    membershipCount: 1,
    context: {
      user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
      active_tenant: tenant,
      active_store: activeStore,
      active_role_code: "tenant_admin",
      memberships: [{ tenant_id: "t1", tenant_name: tenant.name, store_access_kind: "all" }],
    },
  };
}

const stores = {
  status: 200,
  data: [
    { id: "s1", code: "CFC", name: "Cairo Festival City" },
    { id: "s2", code: "NCM", name: "New Cairo Mall" },
  ],
};

function DirtyForm(): React.JSX.Element {
  return (
    <main data-dirty-scope>
      <form>
        <label>
          Tenant name
          <input name="name" />
        </label>
      </form>
    </main>
  );
}

function renderHeaderWithForm(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DirtyGuardProvider>
        <ScopeHeader />
        <DirtyForm />
      </DirtyGuardProvider>
    </QueryClientProvider>,
  );
}

async function chooseStore(name: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /Northstar Retail/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

beforeEach(() => {
  listStores.mockReset();
  listStores.mockResolvedValue(stores);
  activeContext.mockReset();
  switchStore.mockClear();
  clearStore.mockClear();
});

describe("scope change with unsaved work", () => {
  test("a dirty form prompts; Stay keeps the scope and the edits", async () => {
    activeContext.mockReturnValue(value(null));
    renderHeaderWithForm();
    fireEvent.input(screen.getByLabelText("Tenant name"), { target: { value: "Northstar" } });
    await chooseStore("New Cairo Mall");
    fireEvent.click(await screen.findByRole("button", { name: "Stay on this page" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(switchStore).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Tenant name") as HTMLInputElement).value).toBe("Northstar");
    // Focus goes back to the scope button, not to the closed menu.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Northstar Retail/ }));
  });

  test("Discard switches scope", async () => {
    activeContext.mockReturnValue(value(null));
    renderHeaderWithForm();
    fireEvent.input(screen.getByLabelText("Tenant name"), { target: { value: "Northstar" } });
    await chooseStore("New Cairo Mall");
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(switchStore).toHaveBeenCalledWith("s2"));
  });

  test("Discard on 'All stores' clears the store", async () => {
    activeContext.mockReturnValue(value({ id: "s1", name: "Cairo Festival City" }));
    renderHeaderWithForm();
    fireEvent.input(screen.getByLabelText("Tenant name"), { target: { value: "x" } });
    await chooseStore("All stores");
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(clearStore).toHaveBeenCalledTimes(1));
  });

  test("a clean page switches without asking", async () => {
    activeContext.mockReturnValue(value(null));
    renderHeaderWithForm();
    await chooseStore("New Cairo Mall");
    await waitFor(() => expect(switchStore).toHaveBeenCalledWith("s2"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("scope menu keyboard + announcement", () => {
  test("Escape closes the menu and returns focus to the scope button", async () => {
    activeContext.mockReturnValue(value(null));
    renderHeaderWithForm();
    const button = screen.getByRole("button", { name: /Northstar Retail/ });
    fireEvent.click(button);
    const item = await screen.findByRole("menuitem", { name: "All stores" });
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  test("a new scope is announced politely; the first render is not", () => {
    activeContext.mockReturnValue(value(null));
    const { rerender } = render(
      <QueryClientProvider client={createQueryClient()}>
        <ScopeHeader />
      </QueryClientProvider>,
    );
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");

    activeContext.mockReturnValue(value({ id: "s2", name: "New Cairo Mall" }));
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <ScopeHeader />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Now working in Northstar Retail, New Cairo Mall.",
    );
  });
});

describe("deep link to another store's resource", () => {
  function renderBanner(storeId: string): void {
    render(
      <DirtyGuardProvider>
        <ScopeMismatchBanner storeId={storeId} />
      </DirtyGuardProvider>,
    );
  }

  test("asks instead of switching: the scope is never changed on load", async () => {
    activeContext.mockReturnValue(value({ id: "s1", name: "Cairo Festival City" }));
    renderBanner("s2");
    expect(screen.getByRole("region", { name: "Scope" }).textContent).toMatch(
      /link is for a different store/i,
    );
    expect(switchStore).not.toHaveBeenCalled();
  });

  test("'Switch to this store' switches explicitly", async () => {
    activeContext.mockReturnValue(value({ id: "s1", name: "Cairo Festival City" }));
    renderBanner("s2");
    fireEvent.click(screen.getByRole("button", { name: "Switch to this store" }));
    await waitFor(() => expect(switchStore).toHaveBeenCalledWith("s2"));
  });

  test("'Stay' keeps the scope and dismisses the notice", () => {
    activeContext.mockReturnValue(value({ id: "s1", name: "Cairo Festival City" }));
    renderBanner("s2");
    fireEvent.click(screen.getByRole("button", { name: /stay in cairo festival city/i }));
    expect(screen.queryByRole("region", { name: "Scope" })).toBeNull();
    expect(switchStore).not.toHaveBeenCalled();
  });

  test("no notice under 'All stores' or for the active store itself", () => {
    activeContext.mockReturnValue(value(null));
    renderBanner("s2");
    expect(screen.queryByRole("region", { name: "Scope" })).toBeNull();

    activeContext.mockReturnValue(value({ id: "s2", name: "New Cairo Mall" }));
    renderBanner("s2");
    expect(screen.queryByRole("region", { name: "Scope" })).toBeNull();
  });
});

describe("scope change resets the routed surface", () => {
  function Counter(): React.JSX.Element {
    const [n, setN] = useState(0);
    return (
      <button type="button" onClick={() => setN((v) => v + 1)}>
        Filters applied: {n}
      </button>
    );
  }

  function renderArea(): ReturnType<typeof render> {
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route path="/" element={<ProtectedArea />}>
              <Route path="x" element={<Counter />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  test("state that belonged to the old scope is dropped; same scope keeps it", () => {
    activeContext.mockReturnValue(value(null));
    const { rerender } = renderArea();
    fireEvent.click(screen.getByRole("button", { name: /filters applied/i }));
    expect(screen.getByRole("button", { name: /filters applied/i }).textContent).toBe(
      "Filters applied: 1",
    );

    // Same scope re-render: kept.
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route path="/" element={<ProtectedArea />}>
              <Route path="x" element={<Counter />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: /filters applied/i }).textContent).toBe(
      "Filters applied: 1",
    );

    // New scope: reset.
    activeContext.mockReturnValue(value({ id: "s2", name: "New Cairo Mall" }));
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route path="/" element={<ProtectedArea />}>
              <Route path="x" element={<Counter />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: /filters applied/i }).textContent).toBe(
      "Filters applied: 0",
    );
  });
});
