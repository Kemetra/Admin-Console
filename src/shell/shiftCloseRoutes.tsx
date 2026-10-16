import { ShiftCloseDetail } from "@/shift-closes/ShiftCloseDetail";
import { ShiftCloseList } from "@/shift-closes/ShiftCloseList";
/**
 * RT-18 shift-close review route registration. Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 otherwise); the sidebar entry mirrors its roles.
 */
import { Route } from "react-router";

export const shiftCloseRoutes = (
  <>
    <Route path="shift-closes" element={<ShiftCloseList />} />
    <Route path="shift-closes/:shiftId" element={<ShiftCloseDetail />} />
  </>
);
