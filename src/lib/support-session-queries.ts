/**
 * RT-781 (RT-777 S2): the two support-session lifecycle operations of
 * `platform-support-sessions.openapi.yaml` that the session bar calls. Typed
 * wrappers over the generated client in the usual `{ status, data, error }`
 * shape. `openSupportSession` (S3) and `getCurrentSupportSession` (the bar
 * reads `getActiveContext.support_session` instead) have no wrapper here.
 */
import { apiClient } from "@/generated/client";

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
