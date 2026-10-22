/**
 * The Arabic catalog: the authoritative key set (RT-266 plan §3.2). One flat
 * object of dotted keys, assembled from per-surface modules so surfaces don't
 * collide in one file. Keys are namespaced by surface (`shell.nav.stores`),
 * never by English text. tests/unit/i18n-catalog.test.ts fails on a key
 * defined by two modules.
 */
import { aiPlan } from "./ar/aiPlan";
import { audit } from "./ar/audit";
import { auth } from "./ar/auth";
import { cashPolicy } from "./ar/cashPolicy";
import { catalog } from "./ar/catalog";
import { common } from "./ar/common";
import { devices } from "./ar/devices";
import { erp } from "./ar/erp";
import { inventory } from "./ar/inventory";
import { money } from "./ar/money";
import { operators } from "./ar/operators";
import { overview } from "./ar/overview";
import { platform } from "./ar/platform";
import { productRecon } from "./ar/productRecon";
import { saleSync } from "./ar/saleSync";
import { sales } from "./ar/sales";
import { shell } from "./ar/shell";
import { shift } from "./ar/shift";
import { stock } from "./ar/stock";
import { tenants } from "./ar/tenants";

export const AR_MODULES = {
  common,
  shell,
  platform,
  auth,
  tenants,
  operators,
  audit,
  stock,
  shift,
  money,
  overview,
  erp,
  productRecon,
  devices,
  sales,
  saleSync,
  cashPolicy,
  inventory,
  aiPlan,
  catalog,
};

export const ar = {
  ...common,
  ...shell,
  ...platform,
  ...auth,
  ...tenants,
  ...operators,
  ...audit,
  ...stock,
  ...shift,
  ...money,
  ...overview,
  ...erp,
  ...productRecon,
  ...devices,
  ...sales,
  ...saleSync,
  ...cashPolicy,
  ...inventory,
  ...aiPlan,
  ...catalog,
};
