import { describe, expect, test } from "vitest";

import { scopeMenuStores } from "@/shell/scope-stores";

/**
 * RT-354: which stores the scope menu offers. `GET /api/v1/stores` is
 * intentionally not store-access-gated (Backend-Core StoresService.list), so
 * the menu narrows it with the grant list the server already returns on the
 * active membership (`accessible_store_ids`). The server still re-checks every
 * switch (`PUT /context/store` → 404), so this is rendering backend truth, not
 * a frontend authorization decision.
 */
const stores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City" },
  { id: "s2", code: "NCM", name: "New Cairo Mall" },
  { id: "s3", code: "ALX", name: "Alexandria City Centre" },
];

describe("scopeMenuStores", () => {
  test("'all' access lists every store the server returned, in server order", () => {
    const out = scopeMenuStores(stores, { store_access_kind: "all" }, null);
    expect(out.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  test("'specific' access lists only the granted stores", () => {
    const out = scopeMenuStores(
      stores,
      { store_access_kind: "specific", accessible_store_ids: ["s3", "s1"] },
      null,
    );
    expect(out.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  test("'specific' access with no grant list lists nothing (fail closed)", () => {
    const out = scopeMenuStores(stores, { store_access_kind: "specific" }, null);
    expect(out).toEqual([]);
  });

  test("no store_access_kind on the membership defers to the server's list", () => {
    // e.g. a platform admin with no membership row in the active tenant; the
    // server lists the tenant's stores and enforces the switch itself.
    expect(scopeMenuStores(stores, undefined, null)).toHaveLength(3);
    expect(scopeMenuStores(stores, {}, null)).toHaveLength(3);
  });

  test("the active store is always offered, even when the list lacks it", () => {
    const out = scopeMenuStores(
      [],
      { store_access_kind: "specific", accessible_store_ids: ["s9"] },
      { id: "s9", name: "Giza Plaza" },
    );
    expect(out).toEqual([{ id: "s9", name: "Giza Plaza" }]);
  });

  test("the active store is not duplicated when the list already has it", () => {
    const out = scopeMenuStores(
      stores,
      { store_access_kind: "all" },
      {
        id: "s2",
        name: "New Cairo Mall",
      },
    );
    expect(out.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });
});
