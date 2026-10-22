/**
 * `/platform` route family (RT-780, RT-777 S1). A sibling of the protected `/`
 * layout, not a child: the platform console has its own tenant-less gate
 * (PlatformArea) and never goes through ProtectedArea / ScopeGate. The landing
 * is the tenant directory; any other path gets the same non-disclosing state as
 * a non-admin.
 */
import { PlatformArea } from "@/platform/PlatformArea";
import { PlatformNotAvailable } from "@/platform/PlatformNotAvailable";
import { PlatformTenants } from "@/platform/PlatformTenants";
import { Navigate, Route } from "react-router";

export const platformRoutes = (
  <Route path="/platform" element={<PlatformArea />}>
    <Route index element={<Navigate to="tenants" replace />} />
    <Route path="tenants" element={<PlatformTenants />} />
    <Route path="*" element={<PlatformNotAvailable embedded />} />
  </Route>
);
