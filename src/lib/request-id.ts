/**
 * `X-Request-Id` on every Backend-Core call (RT-633, Observability contract
 * RT-629 section 2). The Console mints one lowercase UUID v4 per HTTP call;
 * Backend-Core keeps a well-formed id, echoes it, and mints its own when the
 * header is missing. Installed as openapi-fetch middleware so the committed
 * generated client (src/generated/) stays untouched.
 */
import type { Client, Middleware } from "openapi-fetch";

export const REQUEST_ID_HEADER = "X-Request-Id";

/** A lowercase UUID v4, or undefined where `crypto.randomUUID` is unavailable. */
export function newRequestId(): string | undefined {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid?.toLowerCase();
}

const requestIdMiddleware: Middleware = {
  onRequest({ request }) {
    const id = newRequestId();
    if (id !== undefined) request.headers.set(REQUEST_ID_HEADER, id);
    return request;
  },
};

// biome-ignore lint/suspicious/noExplicitAny: any generated `paths` type.
export function installRequestIdHeader(client: Client<any>): void {
  client.use(requestIdMiddleware);
}
