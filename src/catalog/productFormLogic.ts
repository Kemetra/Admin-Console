import type { BannerVariant } from "@/components/Banner";
/**
 * RT-768 pure rules of the product edit form (CAT-C2a, RT-752 AC 3). No React,
 * no fetch. The contract is the RT-738 writes of `console-catalog.yaml`:
 *
 *   PATCH  /products/{id}         `expectedUpdatedAt` plus the fields that changed
 *   POST   /products/{id}/retire  `expectedUpdatedAt`
 *
 * Decisions in force: D5 (the ends of name and tax category are trimmed, a
 * whitespace-only value is empty), D7 (an error summary on any blocked submit).
 * The client only prevents what is deterministic; permissions, the current
 * version and category availability stay with Backend-Core (UX-08 "Prevent
 * locally. Decide authoritatively."). Helpers return message keys, never copy
 * (RT-399).
 */
import type { MessageKey } from "@/i18n";
import type { CatalogProductDetail } from "@/lib/catalog-queries";

/** Roles the API lets write the catalog; `store_manager` reads only (RT-752 AC 1). */
export const WRITE_ROLES = ["owner", "tenant_admin"] as const;

/** Mirrors the API's write roles to show or hide the controls. Not an authorization decision. */
export function canWriteCatalog(role: string | null | undefined): boolean {
  return (WRITE_ROLES as readonly string[]).includes(role ?? "");
}

export const NAME_MAX = 500;
export const DESCRIPTION_MAX = 2000;
export const TAX_CATEGORY_MAX = 50;

/** The form's `categoryId` when the product has none («بدون فئة»). */
export const NO_CATEGORY = "";

/** What the person sees and edits. Raw: nothing here is trimmed or nulled yet. */
export interface ProductFormValues {
  name: string;
  description: string;
  categoryId: string;
  taxCategory: string;
  isActive: boolean;
}

export function formValuesOf(product: CatalogProductDetail): ProductFormValues {
  const { summary } = product;
  return {
    name: summary.name,
    description: product.description ?? "",
    categoryId: summary.categoryId ?? NO_CATEGORY,
    taxCategory: summary.taxCategory,
    isActive: summary.status === "active",
  };
}

// --- Validation: what the client may prevent --------------------------------------------

/** The fields that can carry an error, in the order of the form. */
export const FIELD_ORDER = ["name", "description", "categoryId", "taxCategory"] as const;
export type ProductField = (typeof FIELD_ORDER)[number];
export type ProductFieldErrors = Partial<Record<ProductField, MessageKey>>;

function nameError(name: string): MessageKey | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "catalog.form.error.nameRequired";
  return trimmed.length > NAME_MAX ? "catalog.form.error.nameTooLong" : undefined;
}

function taxCategoryError(taxCategory: string): MessageKey | undefined {
  const trimmed = taxCategory.trim();
  if (trimmed === "") return "catalog.form.error.taxCategoryRequired";
  return trimmed.length > TAX_CATEGORY_MAX ? "catalog.form.error.taxCategoryTooLong" : undefined;
}

function descriptionError(description: string): MessageKey | undefined {
  return description.length > DESCRIPTION_MAX ? "catalog.form.error.descriptionTooLong" : undefined;
}

/** Every error at once, so the summary lists them all. Empty when the form may be sent. */
export function validateProductForm(values: ProductFormValues): ProductFieldErrors {
  const found: ProductFieldErrors = {
    name: nameError(values.name),
    description: descriptionError(values.description),
    taxCategory: taxCategoryError(values.taxCategory),
  };
  return Object.fromEntries(Object.entries(found).filter(([, key]) => key !== undefined));
}

// --- The patch: only what changed -----------------------------------------------------------

export interface ProductPatch {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  taxCategory?: string;
  isActive?: boolean;
}

/** A description is stored as sent; a blank one is no description (`minLength: 1`). */
function descriptionOf(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

/**
 * The fields the person changed. A field counts as changed only when the input
 * differs from what was loaded, compared raw: a stored name with a trailing
 * space that is left alone is no edit, even though it would trim to something
 * else. A changed name or tax category is sent trimmed at the ends (D5). A
 * category that did not change is never sent: a retired current category would
 * be refused with 422. An empty patch means nothing is submitted.
 */
export function buildPatch(base: ProductFormValues, typed: ProductFormValues): ProductPatch {
  return withoutUndefined({
    name: trimmedChange(base.name, typed.name),
    description: descriptionChange(base.description, typed.description),
    categoryId: typed.categoryId === base.categoryId ? undefined : categoryOf(typed.categoryId),
    taxCategory: trimmedChange(base.taxCategory, typed.taxCategory),
    isActive: typed.isActive === base.isActive ? undefined : typed.isActive,
  });
}

/**
 * The trimmed value to send for a name or tax category, or undefined when it is no edit.
 * Spaces at the ends alone are no edit: sending the trimmed value would rewrite what is
 * stored for nothing (and send everyone else's open form into `stale_write`).
 */
function trimmedChange(base: string, typed: string): string | undefined {
  const next = typed.trim();
  return typed !== base && next !== base ? next : undefined;
}

/** `null` clears the description; undefined when the edit leaves it as stored (blank stays blank). */
function descriptionChange(base: string, typed: string): string | null | undefined {
  if (typed === base) return undefined;
  const next = descriptionOf(typed);
  return next === descriptionOf(base) ? undefined : next;
}

function categoryOf(categoryId: string): string | null {
  return categoryId === NO_CATEGORY ? null : categoryId;
}

/** An absent field is left as is by the API; `null` is a value (clear), so only undefined is dropped. */
function withoutUndefined(patch: ProductPatch): ProductPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as ProductPatch;
}

// --- Category options the list does not carry ------------------------------------------------

export interface CategoryChoice {
  id: string;
  name: string | null;
}

/**
 * `refused`: the server refused it (422) and it stays selected until another is chosen.
 * `retired`: the item's own category, which the list omits because it is retired.
 * `plain`: the item's own category while the list is loading or failed, so nothing is claimed.
 */
export interface ExtraCategoryOption {
  id: string;
  name: string;
  mark: "refused" | "retired" | "plain";
}

function retiredCurrent(
  listed: (id: string) => boolean,
  current: CategoryChoice | null,
  listKnown: boolean,
): ExtraCategoryOption | null {
  if (current === null || listed(current.id)) return null;
  return {
    id: current.id,
    name: current.name ?? current.id,
    mark: listKnown ? "retired" : "plain",
  };
}

function refusedChoice(
  listed: (id: string) => boolean,
  current: CategoryChoice | null,
  refused: CategoryChoice | null,
): ExtraCategoryOption | null {
  if (refused === null) return null;
  if (listed(refused.id)) return null;
  if (refused.id === current?.id) return null;
  return { id: refused.id, name: refused.name ?? refused.id, mark: "refused" };
}

/**
 * The options a category select needs beyond the tenant's list: a refused category (first) and
 * the item's own category when the list omits it. A controlled select that lacks the option for
 * its value would silently show another one.
 */
export function extraCategoryOptions(
  categories: readonly { categoryId: string }[],
  current: CategoryChoice | null,
  refused: CategoryChoice | null,
  listKnown: boolean,
): ExtraCategoryOption[] {
  const listed = (id: string) => categories.some((c) => c.categoryId === id);
  return [
    refusedChoice(listed, current, refused),
    retiredCurrent(listed, current, listKnown),
  ].filter((option): option is ExtraCategoryOption => option !== null);
}

/**
 * After a `stale_write` the product is read again. Typed values are kept only
 * for the fields the person edited; every other field takes the fresh server
 * value, so the next patch cannot revert somebody else's change to a stale
 * value. An edit that was put back counts as untouched.
 */
export function mergeReload(
  oldBase: ProductFormValues,
  typed: ProductFormValues,
  freshBase: ProductFormValues,
): ProductFormValues {
  return {
    name: typed.name !== oldBase.name ? typed.name : freshBase.name,
    description:
      typed.description !== oldBase.description ? typed.description : freshBase.description,
    categoryId: typed.categoryId !== oldBase.categoryId ? typed.categoryId : freshBase.categoryId,
    taxCategory:
      typed.taxCategory !== oldBase.taxCategory ? typed.taxCategory : freshBase.taxCategory,
    isActive: typed.isActive !== oldBase.isActive ? typed.isActive : freshBase.isActive,
  };
}

// --- The failure of a write ---------------------------------------------------------------------

export type ProductWriteOp = "update" | "retire";

export type ProductWriteRender =
  /** 422 `category_unavailable`: the one server error that belongs to a field. */
  | { kind: "field"; field: ProductField; messageKey: MessageKey }
  /** 409 `stale_write`: the item changed since it was opened. A context error. */
  | { kind: "stale"; requestId?: string }
  /** 409 `product_retired`: the item is retired; it cannot be edited or retired again. */
  | { kind: "retired"; requestId?: string }
  /** Every other failure: a persistent banner above the form, not in the summary. */
  | { kind: "banner"; variant: BannerVariant; messageKey: MessageKey; requestId?: string };

export interface ProductWriteFailure {
  op: ProductWriteOp;
  status: number;
  /** `error.code` of the envelope, when there was one. */
  code?: string;
  requestId?: string;
}

function banner(
  variant: BannerVariant,
  messageKey: MessageKey,
  requestId: string | undefined,
): ProductWriteRender {
  return { kind: "banner", variant, messageKey, requestId };
}

function forbidden(code: string | undefined, requestId: string | undefined): ProductWriteRender {
  return banner(
    "danger",
    code === "origin_rejected" ? "catalog.write.error.origin" : "catalog.write.error.forbidden",
    requestId,
  );
}

function conflict({ code, requestId }: ProductWriteFailure): ProductWriteRender {
  if (code === "stale_write") return { kind: "stale", requestId };
  if (code === "product_retired") return { kind: "retired", requestId };
  return banner("danger", "catalog.write.error.conflict", requestId);
}

/**
 * Where a failed write is shown. Only 422 `category_unavailable` has a field to
 * return to (UX-08 "Server-known field errors return to the field"); the 400
 * has no field pointer (RT-752 G9), and authorization, scope, concurrency and
 * state failures stay at the surface (UX-08 "Invalid value ≠ invalid context").
 */
export function mapProductWriteError(failure: ProductWriteFailure): ProductWriteRender {
  const { status, code, requestId } = failure;
  switch (status) {
    case 400:
      return banner("danger", "catalog.write.error.validation", requestId);
    case 401:
      return banner("danger", "catalog.write.error.session", requestId);
    case 403:
      return forbidden(code, requestId);
    case 404:
      return banner("danger", "catalog.write.error.notFound", requestId);
    case 409:
      return conflict(failure);
    case 422:
      return {
        kind: "field",
        field: "categoryId",
        messageKey: "catalog.form.error.categoryUnavailable",
      };
    case 429:
      return banner("warning", "catalog.write.error.rateLimited", requestId);
    default:
      return banner("danger", "catalog.write.error.server", requestId);
  }
}
