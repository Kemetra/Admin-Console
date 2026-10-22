import { createQueryClient } from "@/lib/query";
import { UnknownItemList } from "@/unknown-items/UnknownItemList";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

/** Renders the queue in a fresh query client + router (callers mock the data layer). */
export function renderList(): void {
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
      <UnknownItemList />
    </Tree>,
  );
}
