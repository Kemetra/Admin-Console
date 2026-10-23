/**
 * RT-782: the normal tenant switch (`switchActiveTenant`), offered for a tenant
 * the caller is a member of, from a directory row or after a 409
 * `already_member`. One switch at a time; it lands on the tenant Console only
 * once the switch has answered, and a request that never got an answer is said,
 * not swallowed.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

export function useTenantSwitch(onSwitched: () => void) {
  const { switchTenant } = useActiveContextValue();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [failed, setFailed] = useState(false);

  const toTenant = async (tenantId: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(false);
    try {
      await switchTenant(tenantId);
      onSwitched();
      navigate("/");
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  };

  return { toTenant, failed };
}
