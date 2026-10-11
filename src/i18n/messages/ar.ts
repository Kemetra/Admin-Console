/**
 * The Arabic catalog: the authoritative key set (RT-266 plan §3.2). One flat
 * object of dotted keys, assembled from per-surface modules so surfaces don't
 * collide in one file. Keys are namespaced by surface (`shell.nav.stores`),
 * never by English text. tests/unit/i18n-catalog.test.ts fails on a key
 * defined by two modules.
 */
import { audit } from "./ar/audit";
import { auth } from "./ar/auth";
import { common } from "./ar/common";
import { money } from "./ar/money";
import { operators } from "./ar/operators";
import { shell } from "./ar/shell";
import { stock } from "./ar/stock";
import { tenants } from "./ar/tenants";

export const AR_MODULES = { common, shell, auth, tenants, operators, audit, stock, money };

export const ar = {
  ...common,
  ...shell,
  ...auth,
  ...tenants,
  ...operators,
  ...audit,
  ...stock,
  ...money,
};
