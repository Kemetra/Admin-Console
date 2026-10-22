import {
  deviationsOf,
  identifierTypeKey,
  inventoryPath,
  isProductId,
  storeDeviations,
  storeNameMap,
  tenantAvailable,
} from "@/catalog/catalogDetailLogic";
import { describe, expect, test } from "vitest";
import { CAIRO_STORE, NEW_YORK_STORE, PRODUCT_1, override, product } from "./catalog-fixtures";

/** RT-766 pure helpers: raw deviations (RT-752 D8), the id gate and the stock link. */
const tenant = product();

describe("catalog detail logic (RT-766)", () => {
  test("isProductId accepts a UUID in either case and refuses anything else", () => {
    expect(isProductId(PRODUCT_1)).toBe(true);
    expect(isProductId(PRODUCT_1.toUpperCase())).toBe(true);
    for (const bad of [undefined, "", "new", "123", `${PRODUCT_1}x`]) {
      expect(isProductId(bad)).toBe(false);
    }
  });

  test("only an active product is available at tenant level", () => {
    expect(tenantAvailable({ status: "active" })).toBe(true);
    expect(tenantAvailable({ status: "inactive" })).toBe(false);
    expect(tenantAvailable({ status: "retired" })).toBe(false);
  });

  test("a null override field is no deviation; the others sit beside the tenant value", () => {
    expect(deviationsOf(override() as never, tenant)).toEqual([]);
    expect(
      deviationsOf(
        override({
          isActive: false,
          taxCategory: "reduced",
          price: { amount: "9.0000", currencyCode: "EGP" },
        }) as never,
        tenant,
      ),
    ).toEqual([
      { field: "availability", override: false, tenant: true },
      { field: "taxCategory", override: "reduced", tenant: "standard" },
      {
        field: "price",
        override: { amount: "9.0000", currencyCode: "EGP" },
        tenant: tenant.defaultPrice,
      },
    ]);
  });

  test("an override price beside a tenant with no price keeps the tenant null", () => {
    const [price] = deviationsOf(
      override({ price: { amount: "9.0000", currencyCode: "EGP" } }) as never,
      product({ defaultPrice: null }),
    );
    expect(price).toMatchObject({ field: "price", tenant: null });
  });

  test("overrides keep the server's order and never gain an effective value", () => {
    const stores = storeDeviations(
      [
        override({ storeId: NEW_YORK_STORE, isActive: true }),
        override({ storeId: CAIRO_STORE }),
      ] as never,
      tenant,
    );
    expect(stores.map((s) => s.storeId)).toEqual([NEW_YORK_STORE, CAIRO_STORE]);
    expect(JSON.stringify(stores)).not.toMatch(/effective|resolved/i);
  });

  test("the stock link needs a store in scope and a role the inventory API serves", () => {
    expect(inventoryPath("owner", CAIRO_STORE, PRODUCT_1)).toBe(
      `/inventory/stores/${CAIRO_STORE}/products/${PRODUCT_1}`,
    );
    expect(inventoryPath("owner", null, PRODUCT_1)).toBeNull();
    expect(inventoryPath("store_staff", CAIRO_STORE, PRODUCT_1)).toBeNull();
  });

  test("an unrecognised identifier type is said so", () => {
    expect(identifierTypeKey("barcode")).toBe("catalog.detail.identifierType.barcode");
    expect(identifierTypeKey("hologram")).toBe("catalog.detail.identifierType.unknownCode");
  });

  test("store names come from a list, skip bad rows, and the active store's scope name wins", () => {
    const none = { id: null, name: null };
    expect(storeNameMap({}, none).size).toBe(0);
    expect(storeNameMap(undefined, none).size).toBe(0);
    const names = storeNameMap(
      [{ id: CAIRO_STORE, name: "Old name" }, { id: 7, name: "x" }, null, { id: "s" }],
      { id: CAIRO_STORE, name: "Cairo Festival" },
    );
    expect([...names]).toEqual([[CAIRO_STORE, "Cairo Festival"]]);
  });
});
