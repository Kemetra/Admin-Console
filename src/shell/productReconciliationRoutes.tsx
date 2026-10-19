import { ProductReconciliation } from "@/product-reconciliation/ProductReconciliation";
import { RunResults } from "@/product-reconciliation/RunResults";
/**
 * RT-727 ERPNext product-master reconciliation route registration. Mounts
 * inside the protected layout (`/` → ProtectedArea → AppShell → <Outlet/>),
 * behind RF-1's context gate. Pure additive registration. The API is the
 * authority on who may use it (a non-disclosing 404 otherwise); the page and
 * the sidebar entry mirror its roles (owner / tenant_admin).
 */
import { Route } from "react-router";

export const productReconciliationRoutes = (
  <>
    <Route path="product-reconciliation" element={<ProductReconciliation />} />
    <Route path="product-reconciliation/runs/:runId" element={<RunResults />} />
  </>
);
