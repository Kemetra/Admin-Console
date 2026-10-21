import { CatalogProductList } from "@/catalog/CatalogProductList";
/**
 * RT-765 catalog route registration (CAT-C1a). Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 otherwise); the sidebar entry mirrors its roles. The
 * detail and edit routes under `/catalog/products/…` arrive with their slices
 * (RT-766, RT-768); «الأصناف» stays selected on them (NavLink prefix match).
 */
import { Route } from "react-router";

export const catalogRoutes = <Route path="catalog/products" element={<CatalogProductList />} />;
