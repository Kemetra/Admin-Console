import { DeviceDetail } from "@/devices/DeviceDetail";
import { DeviceList } from "@/devices/DeviceList";
/**
 * RT-371 device registry route registration. Mounts inside the protected
 * layout (`/` → ProtectedArea → AppShell → <Outlet/>), behind RF-1's context
 * gate. Pure additive registration. The API is the authority on who may read
 * (non-disclosing 404 otherwise); the sidebar entry mirrors its roles.
 */
import { Route } from "react-router";

export const deviceRoutes = (
  <>
    <Route path="devices" element={<DeviceList />} />
    <Route path="devices/:deviceId" element={<DeviceDetail />} />
  </>
);
