/**
 * The Console's runtime Sentry config source (RT-673), read through the
 * generated client (VG-3): Backend-Core's `consoleGetTelemetryConfig`
 * (RT-632 #817/#818, `GET /api/v1/console/telemetry/config`).
 *
 *  - 200: the untrusted `{ tunnel, environment }` body; ./config.ts validates it.
 *  - 204: the tunnel is inert, so null (no SDK init, no warning).
 *  - Any other status, or a network/parse failure: throws, and
 *    `initObservability` stays disabled with one value-free warning.
 *
 * The endpoint is public (`security: []`), so the call needs no session and
 * runs the same before and after sign-in.
 */
import { type ApiClient, apiClient } from "@/generated/client";
import type { ConfigSource } from "./init";

export function telemetryConfigSource(client: ApiClient = apiClient): ConfigSource {
  return async () => {
    const { data, response } = await client.GET("/api/v1/console/telemetry/config");
    if (response.status === 204) return null;
    if (response.status === 200) return data ?? null;
    throw new Error("unexpected telemetry config status");
  };
}
