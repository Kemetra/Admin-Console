import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * RF-4a validation gates VG-3 / VG-4 / VG-5 (T012). Mirrors
 * tests/unit/rf2-boundary.test.ts: scoped to hand-written src/ (excludes
 * src/generated/**, the only legit DP2 call surface) with comments stripped so
 * doc references don't false-positive.
 */
function handWrittenSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full.includes("generated")) continue;
    if (statSync(full).isDirectory()) {
      handWrittenSources(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const allFiles = handWrittenSources(join(process.cwd(), "src"));
const allCode = allFiles.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

// The RF-4a surface: its src/ files + the data-layer wrapper.
const rf4aFiles = allFiles.filter(
  (f) => /[\\/]unknown-items[\\/]/.test(f) || f.endsWith("unknown-items-queries.ts"),
);
const rf4aCode = rf4aFiles.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

describe("RF-4a boundary gates", () => {
  test("VG-3: no hand-written fetch/XHR/axios to a DP2 path (generated client only)", () => {
    expect(allCode).not.toMatch(/\bfetch\s*\(/);
    expect(allCode).not.toMatch(/XMLHttpRequest/);
    expect(allCode).not.toMatch(/\baxios\b/);
  });

  test("VG-3: no Authorization/Bearer header set by the console (cookie transport)", () => {
    expect(allCode).not.toMatch(/[Aa]uthorization\s*:/);
    expect(allCode).not.toMatch(/[Bb]earer\s+/);
  });

  test("VG-4: the queue never calls link (deferred, RT-724) or the POS capture op", () => {
    // Link needs a product picker and there is no console catalog read
    // contract to pick from; a free-text product-id field is not an option.
    for (const op of ["tenantAdminLinkUnknownItem", "posCaptureItem", "/link", "product_id"]) {
      expect(rf4aCode).not.toContain(op);
    }
  });

  test("VG-4: RT-724 calls create-product / reopen / bulk-dismiss through the generated client", () => {
    for (const path of [
      '"/api/v1/catalog/unknown-items/{id}/create-product"',
      '"/api/v1/catalog/unknown-items/{id}/reopen"',
      '"/api/v1/catalog/unknown-items/bulk-dismiss"',
    ]) {
      expect(rf4aCode).toContain(path);
    }
  });

  test("VG-4: RF-4a calls no membership or context operation (reads scope via RF-1 provider)", () => {
    for (const op of [
      "listMembers",
      "createInvitation",
      "updateMembership",
      "revokeMembership",
      "acceptInvitation",
      "getActiveContext",
      "switchActiveTenant",
      "switchActiveStore",
      "clearActiveStore",
    ]) {
      expect(rf4aCode).not.toContain(op);
    }
  });

  test("VG-4: the inspect surface renders ReviewQueueItem only — no sale_context", () => {
    // sale_context lives on UnknownItem, not the review projection (FR-007).
    expect(rf4aCode).not.toContain("sale_context");
  });

  test("VG-5: no frontend authorization — no role/is_platform_admin-conditioned hiding", () => {
    expect(rf4aCode).not.toMatch(/is_platform_admin/);
    expect(rf4aCode).not.toMatch(/role_code\s*===/);
    expect(rf4aCode).not.toMatch(/active_role_code/);
  });
});
