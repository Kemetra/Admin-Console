/**
 * The English catalog (the second locale). Every module is typed against its
 * Arabic counterpart, and the whole is typed against the Arabic key set, so a
 * missing English string is a compile error.
 */
import type { ar } from "./ar";
import { audit } from "./en/audit";
import { auth } from "./en/auth";
import { common } from "./en/common";
import { devices } from "./en/devices";
import { erp } from "./en/erp";
import { money } from "./en/money";
import { operators } from "./en/operators";
import { overview } from "./en/overview";
import { shell } from "./en/shell";
import { shift } from "./en/shift";
import { stock } from "./en/stock";
import { tenants } from "./en/tenants";
import type { MessagesOf } from "./types";

export const EN_MODULES = {
  common,
  shell,
  auth,
  tenants,
  operators,
  audit,
  stock,
  shift,
  money,
  overview,
  erp,
  devices,
};

export const en: MessagesOf<typeof ar> = {
  ...common,
  ...shell,
  ...auth,
  ...tenants,
  ...operators,
  ...audit,
  ...stock,
  ...shift,
  ...money,
  ...overview,
  ...erp,
  ...devices,
};
