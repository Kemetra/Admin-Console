import {
  FIELD_ORDER,
  type ProductFormValues,
  buildPatch,
  canWriteCatalog,
  extraCategoryOptions,
  formValuesOf,
  mapProductWriteError,
  mergeReload,
  validateProductForm,
} from "@/catalog/productFormLogic";
import type { CatalogProductDetail } from "@/lib/catalog-queries";
import { describe, expect, test } from "vitest";
import { CATEGORY_1, CATEGORY_2, detail as detailFixture } from "./catalog-fixtures";

const detail = (...args: Parameters<typeof detailFixture>) =>
  detailFixture(...args) as unknown as CatalogProductDetail;

/**
 * RT-768 (CAT-C2a, edit and retire): the pure rules of the product form. The
 * field contract is RT-752 AC 3 with decisions D5 (trim the ends of name and
 * tax category, block whitespace-only) and D7 (summary on any blocked submit).
 */

const BASE: ProductFormValues = {
  name: "Mineral water 1.5L",
  description: "Still spring water.",
  categoryId: CATEGORY_1,
  taxCategory: "standard",
  isActive: true,
};

describe("canWriteCatalog", () => {
  test("owner and tenant_admin write; store_manager and everyone else read only", () => {
    expect(canWriteCatalog("owner")).toBe(true);
    expect(canWriteCatalog("tenant_admin")).toBe(true);
    expect(canWriteCatalog("store_manager")).toBe(false);
    expect(canWriteCatalog("store_staff")).toBe(false);
    expect(canWriteCatalog(null)).toBe(false);
    expect(canWriteCatalog(undefined)).toBe(false);
  });
});

describe("formValuesOf", () => {
  test("reads the loaded product; a null description and a null category read as empty", () => {
    expect(formValuesOf(detail())).toEqual({
      name: "Mineral water 1.5L",
      description: "Still spring water, 1.5 litre bottle.",
      categoryId: CATEGORY_1,
      taxCategory: "standard",
      isActive: true,
    });
    const bare = formValuesOf(detail({ description: null }, { categoryId: null }));
    expect(bare.description).toBe("");
    expect(bare.categoryId).toBe("");
  });

  test("availability is the tenant status: inactive reads unchecked, never retired as active", () => {
    expect(formValuesOf(detail({}, { status: "inactive" })).isActive).toBe(false);
    expect(formValuesOf(detail({}, { status: "active" })).isActive).toBe(true);
  });
});

describe("validateProductForm (what the client may prevent: D5)", () => {
  test("a valid form has no errors", () => {
    expect(validateProductForm(BASE)).toEqual({});
  });

  test("name: required, whitespace-only is empty, at most 500 after trimming the ends", () => {
    expect(validateProductForm({ ...BASE, name: "" }).name).toBe("catalog.form.error.nameRequired");
    expect(validateProductForm({ ...BASE, name: "   \t " }).name).toBe(
      "catalog.form.error.nameRequired",
    );
    expect(validateProductForm({ ...BASE, name: "a".repeat(500) }).name).toBeUndefined();
    expect(validateProductForm({ ...BASE, name: ` ${"a".repeat(500)} ` }).name).toBeUndefined();
    expect(validateProductForm({ ...BASE, name: "a".repeat(501) }).name).toBe(
      "catalog.form.error.nameTooLong",
    );
  });

  test("tax category: required, whitespace-only is empty, at most 50 after trimming", () => {
    expect(validateProductForm({ ...BASE, taxCategory: "" }).taxCategory).toBe(
      "catalog.form.error.taxCategoryRequired",
    );
    expect(validateProductForm({ ...BASE, taxCategory: "  " }).taxCategory).toBe(
      "catalog.form.error.taxCategoryRequired",
    );
    expect(
      validateProductForm({ ...BASE, taxCategory: "x".repeat(50) }).taxCategory,
    ).toBeUndefined();
    expect(validateProductForm({ ...BASE, taxCategory: "x".repeat(51) }).taxCategory).toBe(
      "catalog.form.error.taxCategoryTooLong",
    );
  });

  test("description: optional, at most 2000 characters", () => {
    expect(validateProductForm({ ...BASE, description: "" })).toEqual({});
    expect(validateProductForm({ ...BASE, description: "d".repeat(2000) })).toEqual({});
    expect(validateProductForm({ ...BASE, description: "d".repeat(2001) }).description).toBe(
      "catalog.form.error.descriptionTooLong",
    );
  });

  test("every error at once, so the summary can list them all", () => {
    const errors = validateProductForm({
      ...BASE,
      name: "",
      taxCategory: "",
      description: "d".repeat(2001),
    });
    expect(Object.keys(errors).sort()).toEqual(["description", "name", "taxCategory"]);
  });

  test("field order is the order of the form", () => {
    expect(FIELD_ORDER).toEqual(["name", "description", "categoryId", "taxCategory"]);
  });
});

describe("buildPatch: only what changed (RT-752 AC 3)", () => {
  test("no edit is an empty patch, so nothing is submitted", () => {
    expect(buildPatch(BASE, { ...BASE })).toEqual({});
  });

  test("sends only the changed fields", () => {
    expect(buildPatch(BASE, { ...BASE, taxCategory: "zero" })).toEqual({ taxCategory: "zero" });
    expect(buildPatch(BASE, { ...BASE, isActive: false })).toEqual({ isActive: false });
    expect(buildPatch(BASE, { ...BASE, name: "Water", isActive: false })).toEqual({
      name: "Water",
      isActive: false,
    });
  });

  test("a changed name or tax category is sent trimmed at the ends (D5)", () => {
    expect(buildPatch(BASE, { ...BASE, name: "  Water  " })).toEqual({ name: "Water" });
    expect(buildPatch(BASE, { ...BASE, taxCategory: " zero " })).toEqual({ taxCategory: "zero" });
  });

  test("an edit that only adds spaces at the ends is no change: nothing is written", () => {
    expect(buildPatch(BASE, { ...BASE, name: "Mineral water 1.5L " })).toEqual({});
    expect(buildPatch(BASE, { ...BASE, taxCategory: " standard" })).toEqual({});
  });

  test("trimming a stored value that had spaces at its ends is a change and is sent", () => {
    const stored = { ...BASE, name: "Water ", taxCategory: " standard" };
    expect(buildPatch(stored, { ...stored, name: "Water", taxCategory: "standard" })).toEqual({
      name: "Water",
      taxCategory: "standard",
    });
  });

  test("a loaded value with spaces at its ends is not a change when it is left alone", () => {
    const stored = { ...BASE, name: "Water ", taxCategory: " standard" };
    expect(buildPatch(stored, { ...stored })).toEqual({});
    expect(buildPatch(stored, { ...stored, description: "New" })).toEqual({ description: "New" });
  });

  test("an emptied description clears it with null; a loaded null left empty is no change", () => {
    expect(buildPatch(BASE, { ...BASE, description: "" })).toEqual({ description: null });
    expect(buildPatch(BASE, { ...BASE, description: "   " })).toEqual({ description: null });
    const bare = { ...BASE, description: "" };
    expect(buildPatch(bare, { ...bare })).toEqual({});
    expect(buildPatch(bare, { ...bare, description: "   " })).toEqual({});
  });

  test("a description is sent as typed, not trimmed", () => {
    expect(buildPatch(BASE, { ...BASE, description: " Line one\n" })).toEqual({
      description: " Line one\n",
    });
  });

  test("choosing no category clears it with null; the category is left out when unchanged", () => {
    expect(buildPatch(BASE, { ...BASE, categoryId: "" })).toEqual({ categoryId: null });
    expect(buildPatch(BASE, { ...BASE, categoryId: CATEGORY_2 })).toEqual({
      categoryId: CATEGORY_2,
    });
    // A retired current category is never re-sent (the API would answer 422).
    expect(buildPatch(BASE, { ...BASE, name: "Water" })).not.toHaveProperty("categoryId");
  });

  test("an edit that is put back is no change", () => {
    const typed = { ...BASE, name: "x", isActive: false };
    expect(buildPatch(BASE, { ...typed, name: BASE.name })).toEqual({ isActive: false });
  });
});

describe("extraCategoryOptions: the category options the list does not carry", () => {
  const listed = [{ categoryId: CATEGORY_1 }];
  const gone = { id: CATEGORY_2, name: "Old drinks" };

  test("a current category the list has needs no extra option", () => {
    expect(extraCategoryOptions(listed, { id: CATEGORY_1, name: "Beverages" }, null, true)).toEqual(
      [],
    );
    expect(extraCategoryOptions(listed, null, null, true)).toEqual([]);
  });

  test("a current category missing from a known list is marked retired", () => {
    expect(extraCategoryOptions(listed, gone, null, true)).toEqual([
      { id: CATEGORY_2, name: "Old drinks", mark: "retired" },
    ]);
  });

  test("while the list is loading or failed the current category is shown unmarked", () => {
    expect(extraCategoryOptions(listed, gone, null, false)).toEqual([
      { id: CATEGORY_2, name: "Old drinks", mark: "plain" },
    ]);
  });

  test("a name-less category shows its id", () => {
    expect(extraCategoryOptions([], { id: CATEGORY_2, name: null }, null, true)[0].name).toBe(
      CATEGORY_2,
    );
  });

  test("a refused category the list dropped stays, marked refused, before the current one", () => {
    const refused = { id: "0190f000-0000-7000-8000-0000000007c3", name: "Snacks" };
    expect(extraCategoryOptions(listed, gone, refused, true).map((o) => [o.id, o.mark])).toEqual([
      [refused.id, "refused"],
      [CATEGORY_2, "retired"],
    ]);
  });

  test("a refused category the list still has, or that is the current one, adds nothing", () => {
    expect(extraCategoryOptions(listed, null, { id: CATEGORY_1, name: "Beverages" }, true)).toEqual(
      [],
    );
    expect(extraCategoryOptions(listed, gone, gone, true)).toEqual([
      { id: CATEGORY_2, name: "Old drinks", mark: "retired" },
    ]);
  });
});

describe("mergeReload: typed values kept, untouched fields follow the server (stale_write)", () => {
  const fresh: ProductFormValues = {
    ...BASE,
    name: "Water (renamed by someone else)",
    taxCategory: "reduced",
    isActive: false,
  };

  test("an edited field keeps what the user typed", () => {
    const typed = { ...BASE, description: "My description" };
    const merged = mergeReload(BASE, typed, fresh);
    expect(merged.description).toBe("My description");
  });

  test("an untouched field takes the fresh server value, so another user's edit is not reverted", () => {
    const typed = { ...BASE, description: "My description" };
    const merged = mergeReload(BASE, typed, fresh);
    expect(merged.name).toBe("Water (renamed by someone else)");
    expect(merged.taxCategory).toBe("reduced");
    expect(merged.isActive).toBe(false);
  });

  test("the next patch is the typed fields that still differ from the fresh server values", () => {
    const typed = { ...BASE, description: "My description", taxCategory: "reduced" };
    const merged = mergeReload(BASE, typed, fresh);
    // taxCategory was typed and now equals the server: nothing to send for it.
    expect(buildPatch(fresh, merged)).toEqual({ description: "My description" });
  });

  test("an edit that was put back counts as untouched", () => {
    const typed = { ...BASE, name: "x" };
    const putBack = { ...typed, name: BASE.name };
    expect(mergeReload(BASE, putBack, fresh).name).toBe(fresh.name);
  });
});

describe("mapProductWriteError: every 4xx code of the write contract", () => {
  const rid = "11111111-1111-4111-8111-111111111111";

  test("422 category_unavailable is a field error on the category", () => {
    expect(
      mapProductWriteError({ op: "update", status: 422, code: "category_unavailable" }),
    ).toEqual({
      kind: "field",
      field: "categoryId",
      messageKey: "catalog.form.error.categoryUnavailable",
    });
  });

  test("409 stale_write is the conflict: reload, typed values kept", () => {
    expect(
      mapProductWriteError({ op: "update", status: 409, code: "stale_write", requestId: rid }),
    ).toEqual({ kind: "stale", requestId: rid });
    expect(mapProductWriteError({ op: "retire", status: 409, code: "stale_write" })).toEqual({
      kind: "stale",
      requestId: undefined,
    });
  });

  test("409 product_retired is its own state, for both writes", () => {
    for (const op of ["update", "retire"] as const) {
      expect(mapProductWriteError({ op, status: 409, code: "product_retired" })).toEqual({
        kind: "retired",
        requestId: undefined,
      });
    }
  });

  test("any other 409 is a danger banner, never a field error", () => {
    const render = mapProductWriteError({ op: "update", status: 409, code: "something_else" });
    expect(render).toMatchObject({ kind: "banner", variant: "danger" });
  });

  test.each([
    [400, "validation_error", "danger", "catalog.write.error.validation"],
    [401, undefined, "danger", "catalog.write.error.session"],
    [403, "origin_rejected", "danger", "catalog.write.error.origin"],
    [403, "forbidden", "danger", "catalog.write.error.forbidden"],
    [404, "not_found", "danger", "catalog.write.error.notFound"],
    [429, "rate_limited", "warning", "catalog.write.error.rateLimited"],
    [500, "internal_error", "danger", "catalog.write.error.server"],
    [502, undefined, "danger", "catalog.write.error.server"],
  ] as const)("%i %s is a surface banner (%s), not a field error", (status, code, variant, key) => {
    for (const op of ["update", "retire"] as const) {
      expect(mapProductWriteError({ op, status, code, requestId: rid })).toEqual({
        kind: "banner",
        variant,
        messageKey: key,
        requestId: rid,
      });
    }
  });

  test("an unrecognised status reads as the generic server failure", () => {
    expect(mapProductWriteError({ op: "update", status: 418 })).toMatchObject({
      kind: "banner",
      messageKey: "catalog.write.error.server",
    });
  });
});
