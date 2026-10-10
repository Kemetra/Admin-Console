import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Link, Outlet, RouterProvider, createMemoryRouter, useNavigate } from "react-router";
import { describe, expect, test } from "vitest";

import { DirtyGuardProvider, SAVED_NAVIGATION } from "@/shell/dirty-guard";
import { NavigationBlocker } from "@/shell/navigation-blocker";

/**
 * RT-268 (UX-09): navigating away from a form with unsaved edits asks
 * Stay / Discard. Stay keeps the page and the edits; Discard leaves. Filter
 * forms, forms outside the content area and post-save redirects are never
 * blocked.
 */
function Layout(): React.JSX.Element {
  return (
    <DirtyGuardProvider>
      <NavigationBlocker />
      <Outlet />
    </DirtyGuardProvider>
  );
}

function FormPage({ guard = "on" }: { guard?: "on" | "off" }): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <main data-dirty-scope>
      <h1>Form page</h1>
      <form data-dirty-guard={guard === "off" ? "off" : undefined}>
        <label>
          Name
          <input name="name" defaultValue="" />
        </label>
      </form>
      <Link to="/other">Go elsewhere</Link>
      <button type="button" onClick={() => navigate("/other", { state: SAVED_NAVIGATION })}>
        Saved redirect
      </button>
    </main>
  );
}

function renderAt(page: React.JSX.Element) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/form", element: page },
          { path: "/other", element: <h1>Other page</h1> },
        ],
      },
    ],
    { initialEntries: ["/form"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function type(value: string): void {
  fireEvent.input(screen.getByLabelText("Name"), { target: { value } });
}

describe("NavigationBlocker + DirtyGuardProvider", () => {
  test("a clean form navigates without asking", async () => {
    renderAt(<FormPage />);
    fireEvent.click(screen.getByText("Go elsewhere"));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("a dirty form asks; Stay keeps the page and the edits", async () => {
    const router = renderAt(<FormPage />);
    type("Northstar");
    fireEvent.click(screen.getByText("Go elsewhere"));
    const dialog = await screen.findByRole("alertdialog", { name: /leave without saving/i });
    expect(document.activeElement?.textContent).toBe("Stay on this page");
    fireEvent.click(screen.getByRole("button", { name: "Stay on this page" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(dialog.isConnected).toBe(false);
    expect(router.state.location.pathname).toBe("/form");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Northstar");
  });

  test("Escape in the dialog is Stay", async () => {
    const router = renderAt(<FormPage />);
    type("x");
    fireEvent.click(screen.getByText("Go elsewhere"));
    fireEvent.keyDown(await screen.findByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/form");
  });

  test("Discard leaves the page", async () => {
    renderAt(<FormPage />);
    type("Northstar");
    fireEvent.click(screen.getByText("Go elsewhere"));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
  });

  test("a post-save redirect is not blocked", async () => {
    renderAt(<FormPage />);
    type("Northstar");
    fireEvent.click(screen.getByText("Saved redirect"));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("a filter form (data-dirty-guard=off) is never unsaved work", async () => {
    renderAt(<FormPage guard="off" />);
    type("audit.signin");
    fireEvent.click(screen.getByText("Go elsewhere"));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
  });

  test("a form outside the content area is not tracked", async () => {
    function Outside(): React.JSX.Element {
      return (
        <div>
          <form>
            <label>
              Name
              <input name="name" />
            </label>
          </form>
          <Link to="/other">Go elsewhere</Link>
        </div>
      );
    }
    renderAt(<Outside />);
    type("x");
    fireEvent.click(screen.getByText("Go elsewhere"));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
  });

  test("a dirty form stops counting once it leaves the page", async () => {
    function Toggle(): React.JSX.Element {
      return (
        <main data-dirty-scope>
          <ToggleBody />
          <Link to="/other">Go elsewhere</Link>
        </main>
      );
    }
    let close: () => void = () => {};
    function ToggleBody(): React.JSX.Element | null {
      const [open, setOpen] = useState(true);
      close = () => setOpen(false);
      return open ? (
        <form>
          <label>
            Name
            <input name="name" />
          </label>
        </form>
      ) : null;
    }
    renderAt(<Toggle />);
    type("x");
    act(() => close()); // e.g. a drawer closing after its save
    fireEvent.click(screen.getByText("Go elsewhere"));
    expect(await screen.findByRole("heading", { name: "Other page" })).toBeDefined();
  });
});
