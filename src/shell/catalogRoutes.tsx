import { CatalogProductDetail } from "@/catalog/CatalogProductDetail";
import { CatalogProductList } from "@/catalog/CatalogProductList";
/**
 * RT-765 / RT-766 catalog route registration (CAT-C1a, CAT-C1b). Mounts inside
 * the protected layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind
 * RF-1's context gate. Pure additive registration. The API is the authority on
 * who may read (non-disclosing 404 otherwise); the sidebar entry mirrors its
 * roles. The product detail is a full, deep-linkable page (RT-752 D3). The
 * create and edit routes under `/catalog/products/…` arrive with their slices
 * (RT-768); «الأصناف» stays selected on every child route (NavLink prefix match).
 */
import { Route } from "react-router";

export const catalogRoutes = (
  <>
    <Route path="catalog/products" element={<CatalogProductList />} />
    <Route path="catalog/products/:productId" element={<CatalogProductDetail />} />
  </>
);
