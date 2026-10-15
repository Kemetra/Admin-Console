/**
 * RT-355: where to land after sign-in. ProtectedArea keeps the URL a signed-out
 * user asked for (path + search + hash) in the /signin router state, and
 * SignInRoute sends an auto-selected sign-in back to it.
 *
 * Only a same-origin, in-app path is honored: the value comes from router
 * state, but it is still treated as untrusted (no open redirect). Anything
 * else — an absolute or protocol-relative URL, a scheme, a relative path, or
 * /signin itself — falls back to `/`.
 */

/** Router state carried on the redirect to /signin. */
export interface SignInRedirectState {
  from?: string;
}

const HOME = "/";
const SIGN_IN = "/signin";
/** Any origin works: it only has to be one the input cannot match by accident. */
const PROBE_ORIGIN = "https://console.invalid";

export function returnPathOf(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function safeReturnPath(raw: unknown): string {
  // A single leading "/" that is not followed by "/" or "\" (browsers treat
  // "//host" and "/\host" as protocol-relative).
  if (typeof raw !== "string" || !/^\/(?![/\\])/.test(raw)) return HOME;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return HOME;
  }
  if (url.origin !== PROBE_ORIGIN) return HOME;
  if (trimTrailingSlashes(url.pathname) === SIGN_IN) return HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** A plain scan: `/\/+$/` backtracks quadratically on a long run of slashes. */
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  return path.slice(0, end);
}
