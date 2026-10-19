import {
  canReadInventory,
  canReadTracking,
  integrationStateKey,
  inventoryStatusKey,
  isHiddenSection,
  isUuid,
  locationLabel,
  movementProductId,
  movementTypeKey,
  nextCursorOf,
  readErrorKind,
} from "@/inventory/inventoryLogic";
import type { StockMovement } from "@/lib/inventory-queries";
import { describe, expect, test } from "vitest";

const PRODUCT = "0190f000-0000-7000-8000-0000000007c1";

describe("inventory logic (RT-728)", () => {
  test("read roles: owner, tenant_admin, store_manager; tracking: owner, tenant_admin", () => {
    for (const r of ["owner", "tenant_admin", "store_manager"])
      expect(canReadInventory(r)).toBe(true);
    for (const r of ["cashier", "auditor", "", null, undefined])
      expect(canReadInventory(r)).toBe(false);
    expect(canReadTracking("owner")).toBe(true);
    expect(canReadTracking("tenant_admin")).toBe(true);
    expect(canReadTracking("store_manager")).toBe(false);
  });

  test("route ids must be UUIDs", () => {
    expect(isUuid(PRODUCT)).toBe(true);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  test("an unrecognised code is Unknown; a null ERP state is Not recorded", () => {
    expect(movementTypeKey("transfer_in")).toBe("inventory.movementType.transfer_in");
    expect(movementTypeKey("teleport")).toBe("inventory.value.unknown");
    expect(inventoryStatusKey("damaged")).toBe("inventory.status.damaged");
    expect(inventoryStatusKey("vapour")).toBe("inventory.value.unknown");
    expect(integrationStateKey(null)).toBe("inventory.value.notRecorded");
    expect(integrationStateKey(undefined)).toBe("inventory.value.notRecorded");
    expect(integrationStateKey("confirmed")).toBe("inventory.integration.confirmed");
    expect(integrationStateKey("weird" as never)).toBe("inventory.value.unknown");
  });

  test("an ad-hoc movement has no product to open", () => {
    const m = (ref: string | null | undefined) => ({ tenantProductRef: ref }) as StockMovement;
    expect(movementProductId(m(PRODUCT))).toBe(PRODUCT);
    expect(movementProductId(m(null))).toBeUndefined();
    expect(movementProductId(m(undefined))).toBeUndefined();
    expect(movementProductId(m("not-a-uuid"))).toBeUndefined();
  });

  test("a location not in the store's list has no label (it reads Unknown)", () => {
    const locs = [{ id: "l1", name: "Main floor", code: "MAIN" }];
    expect(locationLabel(locs, "l1")).toBe("Main floor");
    expect(locationLabel(locs, "l2")).toBeUndefined();
    expect(locationLabel(undefined, "l1")).toBeUndefined();
  });

  test("paging stops on a null cursor; errors map by status", () => {
    expect(nextCursorOf({ nextCursor: "c" })).toBe("c");
    expect(nextCursorOf({ nextCursor: null })).toBeUndefined();
    expect(nextCursorOf({})).toBeUndefined();
    expect(readErrorKind(404)).toBe("not-found");
    expect(readErrorKind(429)).toBe("rate-limited");
    expect(readErrorKind(500)).toBe("generic");
    expect(isHiddenSection("forbidden")).toBe(true);
    expect(isHiddenSection("not-found")).toBe(true);
    expect(isHiddenSection("generic")).toBe(false);
  });
});
