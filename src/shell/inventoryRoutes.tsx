import { InventoryProduct } from "@/inventory/InventoryProduct";
import { InventoryStore } from "@/inventory/InventoryStore";
import { InventoryStores } from "@/inventory/InventoryStores";
/**
 * RT-728 inventory read-view route registration. Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 outside the caller's stores); the pages and the sidebar
 * entry mirror the console read roles. The product page is reached from a
 * movement row, never from a free-text product id.
 */
import { Route } from "react-router";

export const inventoryRoutes = (
  <>
    <Route path="inventory" element={<InventoryStores />} />
    <Route path="inventory/stores/:storeId" element={<InventoryStore />} />
    <Route path="inventory/stores/:storeId/products/:productId" element={<InventoryProduct />} />
  </>
);
