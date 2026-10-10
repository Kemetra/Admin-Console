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

export function ScopeMismatchBanner({
  storeId,
}: { storeId: string | undefined }): React.JSX.Element | null {
  const { context, switchStore } = useActiveContextValue();
  const guard = useDirtyGuard();
  const [dismissed, setDismissed] = useState(false);
  const active = context?.active_store;
  if (dismissed || !storeId || !active?.id || active.id === storeId) return null;

  return (
    <section className="rtc-alert rtc-alert--info scope-mismatch" aria-label="Scope">
      <span className="rtc-alert__msg">
        This link is for a different store. You are working in <bdi>{active.name}</bdi>, and your
        scope was not changed.
      </span>
      <span className="scope-mismatch__actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            if (await guard.confirmLeave()) await switchStore(storeId);
          }}
        >
          Switch to this store
        </button>
        <button type="button" className="btn-ghost" onClick={() => setDismissed(true)}>
          Stay in <bdi>{active.name}</bdi>
        </button>
      </span>
    </section>
  );
}
