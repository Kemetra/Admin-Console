import {
  CATALOG_PAGE_SIZE,
  READ_ROLES,
  availabilityKey,
  buildListQuery,
  canReadCatalog,
  dedupeProducts,
  defaultFilters,
  filtersFromSearch,
  filtersToSearch,
  isDefaultFilters,
  listEnded,
  nextCatalogCursor,
  statusKey,
  trackingKey,
  validateFilters,
} from "@/catalog/catalogLogic";
import { describe, expect, test } from "vitest";
import { CAIRO_STORE, CATEGORY_1, PRODUCT_1, PRODUCT_2, product } from "./catalog-fixtures";

describe("catalog logic (RT-765)", () => {
  test("the nav gate mirrors the API's read roles", () => {
    expect([...READ_ROLES]).toEqual(["owner", "tenant_admin", "store_manager"]);
    for (const role of READ_ROLES) expect(canReadCatalog(role)).toBe(true);
    for (const role of ["store_staff", "cashier", "auditor", "", null, undefined]) {
      expect(canReadCatalog(role)).toBe(false);
    }
  });

  describe("keyset paging", () => {
    test("only a null cursor ends the walk; a short or empty page with a cursor does not", () => {
      expect(nextCatalogCursor({ nextCursor: "c1" })).toBe("c1");
      expect(nextCatalogCursor({ nextCursor: null })).toBeUndefined();
      expect(listEnded([])).toBe(false);
      expect(listEnded([{ nextCursor: "c1" }])).toBe(false);
      expect(listEnded([{ nextCursor: "c1" }, { nextCursor: null }])).toBe(true);
    });
  });

  describe("dedupe by productId (RT-752 D4: the later occurrence wins)", () => {
    test("a product seen on two pages is listed once, at its later position", () => {
      const rows = dedupeProducts([
        product({ productId: PRODUCT_1, name: "Alpha" }),
        product({ productId: PRODUCT_2, name: "Bravo" }),
        product({ productId: PRODUCT_1, name: "Alpha renamed" }),
      ]);
      expect(rows.map((r) => r.name)).toEqual(["Bravo", "Alpha renamed"]);
    });

    test("distinct products keep the server order", () => {
      const rows = dedupeProducts([
        product({ productId: PRODUCT_2, name: "Bravo" }),
        product({ productId: PRODUCT_1, name: "Alpha" }),
      ]);
      expect(rows.map((r) => r.name)).toEqual(["Bravo", "Alpha"]);
    });
  });

  describe("filters in the URL", () => {
    test("no parameters is the default: active products, no search, no category", () => {
      const filters = filtersFromSearch(new URLSearchParams());
      expect(filters).toEqual(defaultFilters());
      expect(filters).toEqual({ q: "", status: "active", categoryId: "" });
      expect(isDefaultFilters(filters)).toBe(true);
    });

    test("a round trip keeps every filter; defaults are left out of the URL", () => {
      const filters = { q: "0012", status: "retired" as const, categoryId: CATEGORY_1 };
      const search = filtersToSearch(filters);
      expect(search.toString()).toBe(`q=0012&status=retired&category=${CATEGORY_1}`);
      expect(filtersFromSearch(search)).toEqual(filters);
      expect(filtersToSearch(defaultFilters()).toString()).toBe("");
      expect(isDefaultFilters(filters)).toBe(false);
    });

    test("the search text is kept verbatim: no trim, leading zeros and spaces stay", () => {
      const search = filtersToSearch({ ...defaultFilters(), q: "  0012 " });
      expect(filtersFromSearch(search).q).toBe("  0012 ");
    });

    test("an unknown status falls back to the default", () => {
      expect(filtersFromSearch(new URLSearchParams("status=bogus")).status).toBe("active");
    });
  });

  describe("validateFilters", () => {
    test("a search text over 100 characters is refused before any request", () => {
      expect(validateFilters({ ...defaultFilters(), q: "x".repeat(100) })).toEqual({});
      expect(validateFilters({ ...defaultFilters(), q: "x".repeat(101) })).toEqual({
        q: "catalog.filter.qTooLong",
      });
    });

    test("a category that is not a UUID is refused before any request", () => {
      expect(validateFilters({ ...defaultFilters(), categoryId: CATEGORY_1 })).toEqual({});
      expect(validateFilters({ ...defaultFilters(), categoryId: "not-a-uuid" })).toEqual({
        category: "catalog.filter.categoryInvalid",
      });
    });
  });

  describe("buildListQuery", () => {
    test("always sends the status and the page size; leaves out what is empty", () => {
      expect(buildListQuery(defaultFilters(), null)).toEqual({
        status: "active",
        limit: CATALOG_PAGE_SIZE,
      });
      expect(CATALOG_PAGE_SIZE).toBe(50);
    });

    test("sends q verbatim and the category and store when set", () => {
      expect(
        buildListQuery({ q: " 007 ", status: "any", categoryId: CATEGORY_1 }, CAIRO_STORE),
      ).toEqual({
        q: " 007 ",
        status: "any",
        category_id: CATEGORY_1,
        store_id: CAIRO_STORE,
        limit: 50,
      });
    });
  });

  describe("label keys (machine codes drive copy; an unknown code is not hidden)", () => {
    test("status", () => {
      expect(statusKey("active")).toBe("catalog.status.active");
      expect(statusKey("inactive")).toBe("catalog.status.inactive");
      expect(statusKey("retired")).toBe("catalog.status.retired");
      expect(statusKey("something-new")).toBe("catalog.status.unknownCode");
    });

    test("tracking", () => {
      expect(trackingKey("none")).toBe("catalog.tracking.none");
      expect(trackingKey("batch")).toBe("catalog.tracking.batch");
      expect(trackingKey("serial")).toBe("catalog.tracking.serial");
      expect(trackingKey("something-new")).toBe("catalog.tracking.unknownCode");
    });

    test("store availability", () => {
      expect(availabilityKey(true)).toBe("catalog.availability.yes");
      expect(availabilityKey(false)).toBe("catalog.availability.no");
    });
  });
});
