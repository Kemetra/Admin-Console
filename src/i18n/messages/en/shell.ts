import type { shell as ar } from "../ar/shell";
import type { MessagesOf } from "../types";

export const shell: MessagesOf<typeof ar> = {
  "shell.nav.label": "Primary",
  "shell.nav.overview": "Overview",
  "shell.nav.section.management": "Management",
  "shell.nav.tenants": "Tenants",
  "shell.nav.stores": "Stores",
  "shell.nav.operators": "Operators",
  "shell.nav.audit": "Audit",
  "shell.nav.section.inventory": "Inventory",
  "shell.nav.stockDiscrepancies": "Stock discrepancies",
  "shell.nav.section.cash": "Cash",
  "shell.nav.shiftCloses": "Shift closes",
  "shell.nav.catalog": "Catalog",
  "shell.nav.unknownItems": "Unknown items",
  "shell.signOut": "Sign out",

  "shell.overview.title": "Overview",
  "shell.overview.scope": "{tenant} · {store}",

  "shell.scope.menuGroup": "STORE · {tenant}",
  "shell.scope.allStores": "All stores",
  "shell.scope.loading": "Loading stores…",
  "shell.scope.loadFailed": "Couldn't load stores.",
  "shell.scope.noStores": "No stores you can open in this tenant.",
  "shell.scope.announce": "Now working in {tenant}, {store}.",

  "shell.gate.title": "Select your context",
  "shell.gate.sub": "Choose a tenant to continue.",
  "shell.gate.searchPlaceholder": "Search tenants…",
  "shell.gate.searchLabel": "Search tenants",
  "shell.gate.listLabel": "Available tenants",

  "shell.mismatch.label": "Scope",
  "shell.mismatch.message":
    "This link is for a different store. You are working in {store}, and your scope was not changed.",
  "shell.mismatch.switch": "Switch to this store",
  "shell.mismatch.stay": "Stay in {store}",

  "shell.leave.title": "Leave without saving?",
  "shell.leave.desc": "This page has changes that are not saved. If you leave, they are lost.",
  "shell.leave.stay": "Stay on this page",
  "shell.leave.discard": "Discard changes",

  "components.banner.requestRef": "request_id: {id}",
  "components.list.loading": "Loading {label}…",
  "components.list.loadingDefault": "items",
  "components.confirmDelete.label": "Confirm: {action}",
  "components.confirmDelete.prompt": "{action} {name}? It can be restored by an administrator.",
};
