import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { type Rf2ErrorRender, mapRf2Error } from "@/lib/rf2-queries";
import { SAVED_NAVIGATION } from "@/shell/dirty-guard";
/**
 * SF-S3 — Store create/edit form (T028; RT-400 screens 16 and 17). Scoped to
 * the ACTIVE TENANT: the form has NO tenant picker — on create the active
 * tenant is shown as a read-only scope line (FR-004-005). Pre-gates on the
 * active tenant (OQ-4): no active tenant → scope prompt, the form is not
 * reachable and no call fires.
 *
 * Uncontrolled native form (R4-3); no client-side validation. Branching:
 *   - success → route to the affected store detail, re-fetch
 *   - 409 store-code conflict → inline on the code field (OQ-9)
 *   - 401 no-active-tenant → scope prompt, NOT a sign-out (OQ-4)
 *   - 403 → persistent danger banner with the request reference
 *   - 404 on update → uniform not-available; anything else → generic banner
 * Code is immutable after create (StoreUpdate has no code), so edit shows it
 * read-only. Save sends the name only; the V1 `is_active` flag has its own
 * control in StoreStatusSection, outside the form.
 */
import { useIsMutating } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { StoreStatusSection } from "./StoreStatusSection";
import { STORE_REQUEST_FAILED, storeStatusMutationKey, useStoreMutations } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";
import "../shell/surface.css";

export interface StoreFormProps {
  mode: "create" | "edit";
  /** Required in edit mode. */
  storeId?: string;
  /** Backend values to prefill in edit mode. */
  initial?: { code: string; name: string; is_active?: boolean };
}

/** The 403 render, matched on its catalog copy rather than inferred. */
function isForbidden(render: Rf2ErrorRender): boolean {
  return render.kind === "banner" && render.messageKey === "errors.forbidden";
}

/** A form field's text; a non-text entry (a File) reads as empty, never "[object File]". */
function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function FormBanner({
  render,
  mode,
}: Readonly<{
  render: Rf2ErrorRender;
  mode: StoreFormProps["mode"];
}>): React.JSX.Element | null {
  const t = useT();
  if (render.kind === "scope-required" || render.kind === "conflict") return null;
  const requestId = "requestId" in render ? render.requestId : undefined;
  if (mode === "edit" && isForbidden(render)) {
    return (
      <Banner
        variant="danger"
        title={t("stores.errors.editDeniedTitle")}
        message={t("stores.errors.editDeniedBody")}
        requestId={requestId}
      />
    );
  }
  return <Banner variant="danger" message={t(render.messageKey)} requestId={requestId} />;
}

/** Visual only: the input's `aria-required` already tells assistive tech. */
function RequiredMark(): React.JSX.Element {
  const t = useT();
  return (
    <span className="field__required" aria-hidden="true">
      {t("stores.form.required")}
    </span>
  );
}

/** «بيانات المتجر»: name and code, plus the read-only store ID on edit. */
function StoreFields({
  isEdit,
  storeId,
  initial,
  codeError,
}: Readonly<{
  isEdit: boolean;
  storeId?: string;
  initial: StoreFormProps["initial"];
  codeError?: MessageKey;
}>): React.JSX.Element {
  const t = useT();
  const codeDescribedBy = codeError ? "store-code-hint store-code-error" : "store-code-hint";
  return (
    <div className="surface__form-grid">
      <div className="field">
        <label htmlFor="store-name">
          {t("stores.form.nameLabel")} <RequiredMark />
        </label>
        <input
          id="store-name"
          name="name"
          className="input"
          defaultValue={initial?.name}
          aria-required="true"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="store-code">
          {t("stores.form.codeLabel")} {isEdit ? null : <RequiredMark />}
        </label>
        <input
          id="store-code"
          name="code"
          className="input input--mono"
          dir="ltr"
          defaultValue={initial?.code}
          readOnly={isEdit}
          aria-required={isEdit ? undefined : "true"}
          aria-invalid={codeError ? "true" : undefined}
          aria-describedby={codeDescribedBy}
          autoComplete="off"
        />
        <p id="store-code-hint" className="field__hint">
          {t(isEdit ? "stores.form.codeHintEdit" : "stores.form.codeHintCreate")}
        </p>
        <span id="store-code-error">
          <InlineError message={codeError ? t(codeError) : undefined} />
        </span>
      </div>

      {isEdit ? (
        <div className="field">
          <label htmlFor="store-id">{t("stores.field.id")}</label>
          <input
            id="store-id"
            className="input input--mono"
            dir="ltr"
            defaultValue={storeId}
            readOnly
            aria-describedby="store-id-hint"
          />
          <p id="store-id-hint" className="field__hint">
            {t("stores.form.idHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function StoreForm({ mode, storeId, initial }: Readonly<StoreFormProps>): React.JSX.Element {
  const t = useT();
  const navigate = useNavigate();
  const { activeTenantId, activeTenantName } = useStoreScope();
  const { create, update } = useStoreMutations(activeTenantId, storeId);
  // The catalog key, never a translated string, so a locale switch re-renders it.
  const [codeError, setCodeError] = useState<MessageKey | undefined>();
  const [banner, setBanner] = useState<Rf2ErrorRender | undefined>();
  const [scopeLost, setScopeLost] = useState(false);

  const pending = create.isPending || update.isPending;
  // The status toggle and the name save never run at the same time.
  const statusPending = useIsMutating({ mutationKey: storeStatusMutationKey(storeId ?? "") }) > 0;

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
      setCodeError(render.messageKey);
      return;
    }
    setBanner(render);
  }

  /** Create or update; the detail route on success, undefined after a failure render. */
  async function save(name: string, code: string): Promise<string | undefined> {
    if (mode === "create") {
      const res = await create.mutateAsync({ code, name });
      if (res.status >= 400) {
        handleRender(mapRf2Error({ ...res, context: "store" }));
        return undefined;
      }
      const created = res.data as { id: string } | undefined;
      return created?.id ? `/stores/${created.id}` : undefined;
    }
    const res = await update.mutateAsync({ name });
    if (res.status >= 400) {
      handleRender(mapRf2Error({ ...res, context: "store" }));
      return undefined;
    }
    return storeId ? `/stores/${storeId}` : undefined;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setCodeError(undefined);
    setBanner(undefined);
    const form = new FormData(e.currentTarget);
    try {
      const to = await save(textField(form, "name"), textField(form, "code"));
      if (to) navigate(to, { state: SAVED_NAVIGATION });
    } catch {
      // A thrown request (offline, aborted) is still a visible failure, never silent.
      setBanner(STORE_REQUEST_FAILED);
    }
  }

  const isEdit = mode === "edit";
  const title = isEdit
    ? t.rich("stores.form.editTitle", { name: <bdi>{initial?.name}</bdi> })
    : t("stores.form.createTitle");

  return (
    <div className="surface">
      <header className="surface__head">
        <h1 className="content__title">{title}</h1>
      </header>

      {banner ? <FormBanner render={banner} mode={mode} /> : null}

      {/* Scope is fixed to the active tenant — shown, not selectable (FR-004-005). */}
      {isEdit ? null : (
        <p className="surface__scope-line">
          {t.rich("stores.form.scopeLine", { tenant: <bdi>{activeTenantName}</bdi> })}
        </p>
      )}

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <h2 className="surface__section-title">{t("stores.form.section")}</h2>

        <StoreFields isEdit={isEdit} storeId={storeId} initial={initial} codeError={codeError} />

        <div className="surface__actions surface__actions--divided">
          <button type="submit" className="btn-primary" disabled={pending || statusPending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {t(isEdit ? "stores.form.saveChanges" : "stores.form.create")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(isEdit && storeId ? `/stores/${storeId}` : "/stores")}
            disabled={pending}
          >
            {t(isEdit ? "stores.form.cancelEdit" : "common.cancel")}
          </button>
        </div>
      </form>

      {isEdit && storeId ? (
        <StoreStatusSection
          storeId={storeId}
          storeName={initial?.name}
          isActive={initial?.is_active}
          disabled={pending}
          onStart={() => setBanner(undefined)}
          onError={handleRender}
        />
      ) : null}
    </div>
  );
}
