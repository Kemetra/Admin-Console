import { describe, expect, test } from "vitest";

import { directoryRows, filterTenants } from "@/platform/tenants/directoryLogic";

/**
 * RT-782 (RT-777 S3): the tenant directory's client-side search and row action.
 * `listTenants` returns `TenantSummary` (id, slug, name) only: no status and no
 * store counts, so neither is derived here.
 */
const tenants = [
  { id: "t1", slug: "delta-markets", name: "أسواق الدلتا" },
  { id: "t2", slug: "nile-pharma", name: "Nile Pharma" },
  { id: "t3", slug: "rayan", name: "الريان للتجارة" },
];

describe("filterTenants", () => {
  test("an empty or blank query keeps every tenant in server order", () => {
    expect(filterTenants(tenants, "").map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(filterTenants(tenants, "   ").map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  test("matches the name, case-insensitively, trimmed", () => {
    expect(filterTenants(tenants, "  nile ").map((t) => t.id)).toEqual(["t2"]);
    expect(filterTenants(tenants, "الريان").map((t) => t.id)).toEqual(["t3"]);
  });

  test("matches the slug", () => {
    expect(filterTenants(tenants, "DELTA").map((t) => t.id)).toEqual(["t1"]);
  });

  test("no match is an empty list, not the full list", () => {
    expect(filterTenants(tenants, "zzz")).toEqual([]);
  });

  test("a tenant without a name or slug still lists and never throws", () => {
    expect(filterTenants([{ id: "t9" }], "x")).toEqual([]);
    expect(filterTenants([{ id: "t9" }], "")).toEqual([{ id: "t9" }]);
  });
});

describe("directoryRows", () => {
  test("a tenant the caller is a member of offers the normal switch, not a support session", () => {
    const rows = directoryRows(tenants, [{ tenant_id: "t2" }]);
    expect(rows.map((r) => [r.id, r.action])).toEqual([
      ["t1", "start"],
      ["t2", "switch"],
      ["t3", "start"],
    ]);
  });

  test("rows without an id are dropped: no action could name them", () => {
    expect(directoryRows([{ name: "ghost" }, ...tenants], []).map((r) => r.id)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  test("the name falls back to the slug, then the id", () => {
    const rows = directoryRows([{ id: "a", slug: "only-slug" }, { id: "b" }], []);
    expect(rows.map((r) => r.name)).toEqual(["only-slug", "b"]);
  });
});
