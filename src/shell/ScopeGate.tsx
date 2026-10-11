import { TowerMark } from "@/components/TowerMark";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * Full-screen scope gate (SF-2, T029, Scenario S2). Multi-membership actors
 * pick a tenant here before any RF-2..RF-7 route is reachable (VD-2). Driven by
 * the SF-3 mutators; selecting a tenant re-fetches context, after which the
 * shell renders.
 */
import { useMemo, useState } from "react";
import "./scope-gate.css";

export function ScopeGate(): React.JSX.Element {
  const { context, switchTenant } = useActiveContextValue();
  const [query, setQuery] = useState("");

  const memberships = context?.memberships ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter((m) => (m.tenant_name ?? "").toLowerCase().includes(q));
  }, [memberships, query]);

  return (
    <div className="gate-stage">
      <div className="gate">
        <div className="gate__head">
          <span className="tower-lockup">
            <TowerMark className="tower-mark" />
            <span className="tower-lockup__word">Retail Tower OS</span>
          </span>
          <h1 className="gate__title">Select your context</h1>
          <p className="gate__sub">Choose a tenant to continue.</p>
        </div>

        {memberships.length > 6 ? (
          <div className="gate__search">
            <input
              className="input"
              type="search"
              placeholder="Search tenants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tenants"
            />
          </div>
        ) : null}

        <ul className="pick-list" aria-label="Available tenants">
          {filtered.map((m) => (
            <li key={m.tenant_id}>
              <button
                type="button"
                className="pick"
                onClick={() => m.tenant_id && void switchTenant(m.tenant_id)}
              >
                <span className="pick__avatar" aria-hidden="true">
                  {(m.tenant_name ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="pick__body">
                  <span className="pick__name">{m.tenant_name ?? m.tenant_id}</span>
                  <span className="pick__meta">{m.tenant_id}</span>
                </span>
                {m.role_code ? <span className="pick__role">{m.role_code}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
