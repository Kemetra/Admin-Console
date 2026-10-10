import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type Rf2ErrorRender, mapRf2Error } from "@/lib/rf2-queries";
import { SAVED_NAVIGATION } from "@/shell/dirty-guard";
/**
 * SF-T3 — Tenant create/edit form (T018). Uncontrolled native form (research
 * R4-3; no form library). No client-side validation — the backend is the
 * validation authority (FR-004-004). Field errors render inline (InlineError +
 * aria-invalid); surface errors render in the persistent Banner.
 *
 * Branching (mapped to the statuses the contract documents @ 62d0906):
 *   - success → route to the affected tenant detail, re-fetch
 *   - 409 slug conflict → inline on the slug field (OQ-9)
 *   - 403 → persistent banner with request_id
 *   - 404 on update → uniform not-available
 * The contract documents no 422/429, so none is handled. Slug is immutable
 * after create (TenantUpdate has no slug), so the edit form renders it read-only.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useTenantMutations } from "./useTenantQueries";
import "../shell/surface.css";

export interface TenantFormProps {
  mode: "create" | "edit";
  /** Required in edit mode. */
  tenantId?: string;
  /** Backend values to prefill in edit mode. */
  initial?: { slug: string; name: string; status?: "active" | "suspended" | "pending" };
}

export function TenantForm({ mode, tenantId, initial }: TenantFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const { create, update } = useTenantMutations(tenantId);
  const [slugError, setSlugError] = useState<string | undefined>();
  const [banner, setBanner] = useState<Rf2ErrorRender | undefined>();

  const pending = create.isPending || update.isPending;

  function handleRender(render: Rf2ErrorRender): void {
    if (render.kind === "conflict" && render.field === "slug") {
      setSlugError(render.message);
      return;
    }
    setBanner(render);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSlugError(undefined);
    setBanner(undefined);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");

    if (mode === "create") {
      const slug = String(form.get("slug") ?? "");
      const res = await create.mutateAsync({ slug, name });
      if (res.status >= 400) {
        handleRender(mapRf2Error({ ...res, context: "tenant" }));
        return;
      }
      const created = res.data as { id: string } | undefined;
      if (created?.id) navigate(`/tenants/${created.id}`, { state: SAVED_NAVIGATION });
      return;
    }

    const res = await update.mutateAsync({ name });
    if (res.status >= 400) {
      handleRender(mapRf2Error({ ...res, context: "tenant" }));
      return;
    }
    if (tenantId) navigate(`/tenants/${tenantId}`, { state: SAVED_NAVIGATION });
  }

  const title = mode === "create" ? "New tenant" : "Edit tenant";
  const submitLabel = mode === "create" ? "Create tenant" : "Save changes";

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

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="tenant-slug">Slug</label>
          <input
            id="tenant-slug"
            name="slug"
            className="input"
            defaultValue={initial?.slug}
            readOnly={mode === "edit"}
            aria-invalid={slugError ? "true" : undefined}
            aria-describedby={slugError ? "tenant-slug-error" : undefined}
            autoComplete="off"
          />
          <span id="tenant-slug-error">
            <InlineError message={slugError} />
          </span>
        </div>

        <div className="field">
          <label htmlFor="tenant-name">Name</label>
          <input
            id="tenant-name"
            name="name"
            className="input"
            defaultValue={initial?.name}
            autoComplete="off"
          />
        </div>

        <div className="surface__actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {submitLabel}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              navigate(mode === "edit" && tenantId ? `/tenants/${tenantId}` : "/tenants")
            }
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
