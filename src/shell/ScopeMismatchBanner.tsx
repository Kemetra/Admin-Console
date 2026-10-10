import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * RT-268 (UX-09): deep links never silently change scope. When a route names a
 * store other than the active one, say so and offer an explicit switch; "Stay"
 * keeps the current scope and dismisses the notice. Under "All stores" the
 * store is already inside the tenant-wide scope, so nothing is shown.
 */
import { useState } from "react";
import { useDirtyGuard } from "./dirty-guard";
import "./scope-mismatch.css";

interface Mismatch {
  routeStoreId: string;
  activeName: string | undefined;
}

/** The mismatch when the route names a store and a different store is active. */
function storeMismatch(
  routeStoreId: string | undefined,
  active: { id?: string; name?: string } | null | undefined,
): Mismatch | null {
  if (!routeStoreId || !active?.id) return null;
  return routeStoreId === active.id ? null : { routeStoreId, activeName: active.name };
}

export function ScopeMismatchBanner({
  storeId,
}: { storeId: string | undefined }): React.JSX.Element | null {
  const { context, switchStore } = useActiveContextValue();
  const guard = useDirtyGuard();
  const [dismissed, setDismissed] = useState(false);
  const mismatch = dismissed ? null : storeMismatch(storeId, context?.active_store);
  if (!mismatch) return null;

  return (
    <section className="rtc-alert rtc-alert--info scope-mismatch" aria-label="Scope">
      <span className="rtc-alert__msg">
        This link is for a different store. You are working in <bdi>{mismatch.activeName}</bdi>, and
        your scope was not changed.
      </span>
      <span className="scope-mismatch__actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            if (await guard.confirmLeave()) await switchStore(mismatch.routeStoreId);
          }}
        >
          Switch to this store
        </button>
        <button type="button" className="btn-ghost" onClick={() => setDismissed(true)}>
          Stay in <bdi>{mismatch.activeName}</bdi>
        </button>
      </span>
    </section>
  );
}
