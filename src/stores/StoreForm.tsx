import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type Rf2ErrorRender, mapRf2Error } from "@/lib/rf2-queries";
import { SAVED_NAVIGATION } from "@/shell/dirty-guard";
/**
 * SF-S3 — Store create/edit form (T028). Scoped to the ACTIVE TENANT: the form
 * has NO tenant picker — the active tenant from RF-1's provider is shown as a
 * read-only scope line (FR-004-005). Pre-gates on the active tenant (OQ-4): no
 * active tenant → scope prompt, the form is not reachable and no call fires.
 *
 * Uncontrolled native form (R4-3); no client-side validation. Branching:
 *   - success → route to the affected store detail, re-fetch
 *   - 409 store-code conflict → inline on the code field (OQ-9)
 *   - 401 no-active-tenant → scope prompt, NOT a sign-out (OQ-4)
 *   - 403 → persistent banner; 404 on update → uniform not-available
 * No 422/429 (contract documents none). Code is immutable after create
 * (StoreUpdate has no code), so the edit form renders it read-only.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { useStoreMutations } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";
import "../shell/surface.css";

export interface StoreFormProps {
  mode: "create" | "edit";
  /** Required in edit mode. */
  storeId?: string;
  /** Backend values to prefill in edit mode. */
  initial?: { code: string; name: string; is_active?: boolean };
}

export function StoreForm({ mode, storeId, initial }: StoreFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const { activeTenantId, activeTenantName } = useStoreScope();
  const { create, update } = useStoreMutations(activeTenantId, storeId);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [banner, setBanner] = useState<Rf2ErrorRender | undefined>();
  const [scopeLost, setScopeLost] = useState(false);

  const pending = create.isPending || update.isPending;

  // Pre-gate: no active tenant -> scope prompt, the form is not reachable (OQ-4).
  if (!activeTenantId || scopeLost) {
    return <ScopePrompt />;
  }

  function handleRender(render: Rf2ErrorRender): void {
    if (render.kind === "scope-required") {
      // Residual 401: route to the scope prompt, never a sign-out (OQ-4).
      setScopeLost(true);
      return;
    }
    if (render.kind === "conflict" && render.field === "code") {
      setCodeError(render.message);
      return;
    }
    setBanner(render);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setCodeError(undefined);
    setBanner(undefined);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");

    if (mode === "create") {
      const code = String(form.get("code") ?? "");
      const res = await create.mutateAsync({ code, name });
      if (res.status >= 400) {
        handleRender(mapRf2Error({ ...res, context: "store" }));
        return;
      }
      const created = res.data as { id: string } | undefined;
      if (created?.id) navigate(`/stores/${created.id}`, { state: SAVED_NAVIGATION });
      return;
    }

    const isActive = form.get("is_active") === "on";
    const res = await update.mutateAsync({ name, is_active: isActive });
    if (res.status >= 400) {
      handleRender(mapRf2Error({ ...res, context: "store" }));
      return;
    }
    if (storeId) navigate(`/stores/${storeId}`, { state: SAVED_NAVIGATION });
  }

  const title = mode === "create" ? "New store" : "Edit store";
  const submitLabel = mode === "create" ? "Create store" : "Save changes";

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{title}</h1>
        </div>
      </header>

      {banner && (banner.kind === "banner" || banner.kind === "not-found") ? (
        <Banner
          variant="danger"
          message={banner.message}
          requestId={banner.kind === "banner" ? banner.requestId : undefined}
        />
      ) : null}

      {/* Scope is fixed to the active tenant — shown, not selectable (FR-004-005). */}
      <p className="surface__scope-line">
        Creating in tenant <strong>{activeTenantName}</strong>.
      </p>

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="store-code">Code</label>
          <input
            id="store-code"
            name="code"
            className="input"
            defaultValue={initial?.code}
            readOnly={mode === "edit"}
            aria-invalid={codeError ? "true" : undefined}
            aria-describedby={codeError ? "store-code-error" : undefined}
            autoComplete="off"
          />
          <span id="store-code-error">
            <InlineError message={codeError} />
          </span>
        </div>

        <div className="field">
          <label htmlFor="store-name">Name</label>
          <input
            id="store-name"
            name="name"
            className="input"
            defaultValue={initial?.name}
            autoComplete="off"
          />
        </div>

        {mode === "edit" ? (
          <label className="field-checkbox">
            <input type="checkbox" name="is_active" defaultChecked={initial?.is_active ?? true} />
            Active
          </label>
        ) : null}

        <div className="surface__actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {submitLabel}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(mode === "edit" && storeId ? `/stores/${storeId}` : "/stores")}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
