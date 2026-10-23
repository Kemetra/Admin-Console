import { SalesDaily } from "@/sales-daily/SalesDaily";
import { SaleDetail } from "@/sales/SaleDetail";
import { SaleList } from "@/sales/SaleList";
/**
 * RT-587 sales route registration (spec 012). Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 otherwise); the sidebar entry mirrors its roles.
 * RT-821: the daily received-sales report is a Sales sibling (RT-751 D6),
 * reached from the Sales screen, not from its own sidebar entry (UX-09).
 */
import { Route } from "react-router";

export const saleRoutes = (
  <>
    <Route path="sales" element={<SaleList />} />
    <Route path="sales/:saleRef" element={<SaleDetail />} />
    <Route path="sales-daily" element={<SalesDaily />} />
  </>
);
