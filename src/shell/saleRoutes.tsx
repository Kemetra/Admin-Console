import { SaleDetail } from "@/sales/SaleDetail";
import { SaleList } from "@/sales/SaleList";
/**
 * RT-587 sales route registration (spec 012). Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 otherwise); the sidebar entry mirrors its roles.
 */
import { Route } from "react-router";

export const saleRoutes = (
  <>
    <Route path="sales" element={<SaleList />} />
    <Route path="sales/:saleRef" element={<SaleDetail />} />
  </>
);
