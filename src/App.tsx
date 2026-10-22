import { AcceptInvitation } from "@/auth/AcceptInvitation";
import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { DocumentLocale } from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { RouteErrorFallback } from "@/observability/RouteErrorFallback";
import { Overview } from "@/shell/Overview";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { SignInRoute } from "@/shell/SignInRoute";
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
 *
 * RT-268: a data router (createBrowserRouter) so the unsaved-work guard can
 * block navigation (useBlocker). The route tree is unchanged; the root layout
 * hosts the providers the routes read.
 */
import { catalogRoutes } from "@/shell/catalogRoutes";
import { deviceRoutes } from "@/shell/deviceRoutes";
import { DirtyGuardProvider } from "@/shell/dirty-guard";
import { erpStatusRoutes } from "@/shell/erpStatusRoutes";
import { inventoryRoutes } from "@/shell/inventoryRoutes";
import { NavigationBlocker } from "@/shell/navigation-blocker";
import { payerRoutes } from "@/shell/payerRoutes";
import { platformRoutes } from "@/shell/platformRoutes";
import { productReconciliationRoutes } from "@/shell/productReconciliationRoutes";
import { rf2Routes } from "@/shell/rf2Routes";
import { rf4aRoutes } from "@/shell/rf4aRoutes";
import { rf5Routes } from "@/shell/rf5Routes";
import { rf6Routes } from "@/shell/rf6Routes";
import { saleRoutes } from "@/shell/saleRoutes";
import { saleSyncRoutes } from "@/shell/saleSyncRoutes";
import { shiftCloseRoutes } from "@/shell/shiftCloseRoutes";
import { stockDiscrepancyRoutes } from "@/shell/stockDiscrepancyRoutes";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router";
import "@/styles/tokens.css";
import "@/styles/controls.css";
import "@/styles/a11y.css";

const queryClient = createQueryClient();

function RootLayout(): React.JSX.Element {
  return (
    <ActiveContextProvider>
      {/* RT-399: <html lang/dir> and the title follow the active locale. */}
      <DocumentLocale />
      <DirtyGuardProvider>
        <NavigationBlocker />
        <Outlet />
      </DirtyGuardProvider>
    </ActiveContextProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    // RT-633: a data router catches route errors itself; report them and show
    // the safe fallback instead of the router's default error screen.
    <Route element={<RootLayout />} errorElement={<RouteErrorFallback />}>
      <Route path="/signin" element={<SignInRoute />} />
      {/* Public accept-invitation (SF5-4, security: []) — sibling of /signin. */}
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      {/* RT-780: the platform console has its own tenant-less gate. */}
      {platformRoutes}
      <Route path="/" element={<ProtectedArea />}>
        <Route index element={<Overview />} />
        {rf2Routes}
        {rf4aRoutes}
        {rf5Routes}
        {rf6Routes}
        {catalogRoutes}
        {payerRoutes}
        {stockDiscrepancyRoutes}
        {inventoryRoutes}
        {shiftCloseRoutes}
        {erpStatusRoutes}
        {productReconciliationRoutes}
        {deviceRoutes}
        {saleRoutes}
        {saleSyncRoutes}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ),
);

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
