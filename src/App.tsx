import { AcceptInvitation } from "@/auth/AcceptInvitation";
import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { SignInRoute } from "@/shell/SignInRoute";
import { payerRoutes } from "@/shell/payerRoutes";
import { receivableRoutes } from "@/shell/receivableRoutes";
import { rf2Routes } from "@/shell/rf2Routes";
import { rf4aRoutes } from "@/shell/rf4aRoutes";
import { rf5Routes } from "@/shell/rf5Routes";
import { rf6Routes } from "@/shell/rf6Routes";
import { stockDiscrepancyRoutes } from "@/shell/stockDiscrepancyRoutes";
/**
 * RF-1 application root, extended by RF-2 (T009). Composes the providers and the
 * public/protected boundary (R3-1): `/signin` is public (SF-1); everything else
 * is a PROTECTED LAYOUT route whose element (ProtectedArea) renders the
 * gate-or-shell from the server-resolved context, with the routed surface
 * mounting in the shell's <Outlet/>.
 *
 * The route guard reacts to backend truth only (FR-003-004): a 401 on the
 * CONTEXT fetch is caught by RF-1's per-call interceptor and redirects to
 * /signin (S5). RF-2's own operation 401s do NOT route through sign-out — store
 * surfaces pre-gate on the active tenant (OQ-4). The console carries no
 * authorization opinion about routes; RF-2 routes sit inside the same gate.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "@/styles/tokens.css";
import "@/styles/controls.css";
import "@/styles/a11y.css";

const queryClient = createQueryClient();

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ActiveContextProvider>
          <Routes>
            <Route path="/signin" element={<SignInRoute />} />
            {/* Public accept-invitation (SF5-4, security: []) — sibling of /signin. */}
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route path="/" element={<ProtectedArea />}>
              <Route index element={<Overview />} />
              {rf2Routes}
              {rf4aRoutes}
              {rf5Routes}
              {rf6Routes}
              {payerRoutes}
              {receivableRoutes}
              {stockDiscrepancyRoutes}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ActiveContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
