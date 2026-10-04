import { StockDiscrepancyStore } from "@/stock-discrepancies/StockDiscrepancyStore";
import { StockDiscrepancyStores } from "@/stock-discrepancies/StockDiscrepancyStores";
/**
 * RT-178 ERPNext stock discrepancy route registration. Mounts inside the
 * protected layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's
 * context gate. Pure additive registration. The API is the authority on who
 * may read (non-disclosing 404 otherwise); the sidebar entry mirrors its roles.
 */
import { Route } from "react-router";

export const stockDiscrepancyRoutes = (
  <>
    <Route path="stock-discrepancies" element={<StockDiscrepancyStores />} />
    <Route path="stock-discrepancies/:storeId" element={<StockDiscrepancyStore />} />
  </>
);
