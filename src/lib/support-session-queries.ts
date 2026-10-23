/**
 * RT-781 (RT-777 S2): the support-session operations of
 * `platform-support-sessions.openapi.yaml` that the Console calls. Typed
 * wrappers over the generated client in the usual `{ status, data, error }`
 * shape: renew and end for the session bar, open for the start drawer (RT-782,
 * S3). `getCurrentSupportSession` has no wrapper: the bar reads
 * `getActiveContext.support_session` instead.
 */
import { apiClient } from "@/generated/client";
import type { components } from "@/generated/schema";

/** POST /api/v1/platform/support-sessions. The body is built by `buildOpenRequest` only. */
export async function openSupportSession(body: components["schemas"]["OpenSupportSessionRequest"]) {
  const { data, error, response } = await apiClient.POST("/api/v1/platform/support-sessions", {
    body,
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/platform/support-sessions/current/renew */
export async function renewSupportSession() {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/platform/support-sessions/current/renew",
    {},
  );
  return { status: response.status, data, error };
}

/** POST /api/v1/platform/support-sessions/current/end */
export async function endSupportSession() {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/platform/support-sessions/current/end",
    {},
  );
  return { status: response.status, data, error };
}
