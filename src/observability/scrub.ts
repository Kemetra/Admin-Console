/**
 * Sentry `beforeSend` scrubber for the Console (RT-633, OBS-4). Pure and
 * SDK-free so it is unit-testable without a live SDK.
 *
 * Conforms to the Observability contract (RT-629) section 3, using Backend-Core's
 * `packages/shared/src/observability/sentry.ts` (RT-609) as the reference:
 *  - Allowlist rebuild: the outgoing event keeps a short list of safe fields.
 *    `request`, `user`, `extra`, `contexts`, breadcrumbs, `transaction`, frame
 *    `vars` and source lines are dropped wholesale.
 *  - Tags are an allowlist too (contract section 1). Ids (tenant, store, user,
 *    device, sale) and free text are never tags.
 *  - JWTs, URL userinfo/query/fragment, emails and Postgres row values are
 *    masked anywhere in a message, with index scans only (linear time on
 *    untrusted input, no backtracking regex).
 */

/** Max length of an exception message that leaves the browser. */
const MAX_MESSAGE_LENGTH = 300;
// Bounds the work done on untrusted input before any scanning runs.
const MAX_SCAN_LENGTH = 2000;

/** Contract section 1: the only tags an event may carry, all bounded. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "service",
  "env",
  "version",
  "route",
  "method",
  "status",
  "status_class",
  "queue",
  "job_name",
  "error_class",
  "outcome",
]);

export interface SentryFrameLike {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  module?: string;
  in_app?: boolean;
  [key: string]: unknown;
}

export interface SentryExceptionValueLike {
  type?: string;
  value?: string;
  mechanism?: { type?: string; handled?: boolean; [key: string]: unknown };
  stacktrace?: { frames?: SentryFrameLike[]; [key: string]: unknown };
  [key: string]: unknown;
}

/** Structural subset of a Sentry event; only what the scrubber reads or emits. */
export interface SentryEventLike {
  event_id?: string;
  timestamp?: number;
  platform?: string;
  level?: string;
  environment?: string;
  release?: string;
  server_name?: string;
  sdk?: { settings?: { infer_ip?: string }; [key: string]: unknown };
  tags?: Record<string, unknown>;
  exception?: { values?: SentryExceptionValueLike[] };
  [key: string]: unknown;
}

const SAFE_TOP_LEVEL = [
  "event_id",
  "timestamp",
  "platform",
  "level",
  "environment",
  "release",
  "server_name",
] as const;

// Postgres echoes row values after these markers ("Key (email)=(a@b.c) already
// exists.", "Failing row contains (1, a@b.c, ...)"). Values may contain
// parentheses, so everything from the marker on is masked (indexOf, no regex).
const POSTGRES_ROW_MARKERS = [
  { marker: "Key (", mask: "Key (...)=(...)" },
  { marker: "Failing row contains (", mask: "Failing row contains (...)" },
] as const;
const SCHEME_CHAR = /^[a-z0-9+.-]$/i;
/** Characters that open a URL query or fragment. */
const QUERY_MARKS: ReadonlySet<string> = new Set(["?", "#"]);
const TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([`"`, "'", ")", "]", ",", ";", ".", ">"]);
const FRAME_LOCATION_KEYS = ["function", "lineno", "colno", "module", "in_app"] as const;
const MECHANISM_KEYS = ["type", "handled"] as const;

/** Copy only the listed keys whose value is defined. */
function pickDefined<K extends string>(
  source: Partial<Record<K, unknown>>,
  keys: readonly K[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function maskPostgresRowValues(value: string): string {
  let out = value;
  for (const { marker, mask } of POSTGRES_ROW_MARKERS) {
    const at = out.indexOf(marker);
    if (at !== -1) out = `${out.slice(0, at)}${mask}`;
  }
  return out;
}

/**
 * One whitespace-delimited token of an exception message. Secrets are masked
 * wherever they sit in it (`token=eyJ…`, `"https://u:p@host/x?api_key=…"`):
 * URLs first (userinfo and query), then any other query or fragment
 * (scheme-less URLs and paths), then JWTs, then emails. Index scans only, so the
 * work stays linear on untrusted input.
 */
class MessageToken {
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  scrubbed(): string {
    const masked = this.withoutUrl().withoutQuery().withoutJwt();
    return masked.isEmailLike() ? "[email]" : masked.text;
  }

  /** Keep scheme + host + path; drop userinfo, query, fragment. Unparsable -> `[url]`. */
  withoutUrl(): MessageToken {
    const sep = this.text.indexOf("://");
    const start = sep > 0 ? this.schemeStart(sep) : sep;
    if (start < 0 || start === sep) return this;
    const raw = this.text.slice(start);
    const end = new MessageToken(raw).bodyLength();
    const url = parseUrl(raw.slice(0, end));
    const safe = url ? `${url.protocol}//${url.host}${url.pathname}` : "[url]";
    return new MessageToken(`${this.text.slice(0, start)}${safe}${raw.slice(end)}`);
  }

  /**
   * Drop a query or fragment the URL pass did not see (`/v1/x?phone=…`,
   * `host/x#token=…`, `?phone=…`). A `?` or `#` that ends the token, or opens
   * it without any `key=value` ("valid?", "#42"), is not one, so ordinary
   * sentences survive.
   */
  withoutQuery(): MessageToken {
    if (QUERY_MARKS.has(this.text.charAt(0)) && this.text.includes("=")) {
      return new MessageToken("");
    }
    for (let i = 1; i < this.text.length - 1; i++) {
      if (QUERY_MARKS.has(this.text.charAt(i))) return new MessageToken(this.text.slice(0, i));
    }
    return this;
  }

  toString(): string {
    return this.text;
  }

  /** Mask a JWT (even without its signature) and everything after it. */
  private withoutJwt(): MessageToken {
    const at = this.text.indexOf("eyJ");
    if (at === -1 || !this.text.includes(".", at)) return this;
    return new MessageToken(`${this.text.slice(0, at)}[jwt]`);
  }

  private isEmailLike(): boolean {
    const at = this.text.indexOf("@");
    return at > 0 && this.text.includes(".", at);
  }

  /** Index where the URL scheme ending at `sep` (the `://`) starts. */
  private schemeStart(sep: number): number {
    let start = sep;
    while (start > 0 && SCHEME_CHAR.test(this.text.charAt(start - 1))) start--;
    return start;
  }

  /** Length without trailing quotes/brackets/punctuation. */
  private bodyLength(): number {
    let end = this.text.length;
    while (end > 0 && TRAILING_PUNCTUATION.has(this.text.charAt(end - 1))) end--;
    return end;
  }
}

function sanitizeMessage(value: string): string {
  const cleaned = maskPostgresRowValues(value.slice(0, MAX_SCAN_LENGTH))
    .split(/(\s+)/)
    .map((token) => new MessageToken(token).scrubbed())
    .join("");
  return cleaned.length > MAX_MESSAGE_LENGTH
    ? `${cleaned.slice(0, MAX_MESSAGE_LENGTH - 3)}...`
    : cleaned;
}

/** Browser frame filenames are URLs or paths: keep scheme + host + path only. */
function scrubFrame(frame: SentryFrameLike): Record<string, unknown> {
  const out = pickDefined(frame, FRAME_LOCATION_KEYS);
  if (typeof frame.filename === "string") {
    const capped = frame.filename.slice(0, MAX_SCAN_LENGTH);
    out.filename = new MessageToken(capped).withoutUrl().withoutQuery().toString();
  }
  return out;
}

function scrubException(entry: SentryExceptionValueLike): SentryExceptionValueLike {
  const out: SentryExceptionValueLike = {};
  // `type` is `error.name`, which app code can set to any text.
  if (typeof entry.type === "string") out.type = sanitizeMessage(entry.type);
  if (typeof entry.value === "string") out.value = sanitizeMessage(entry.value);
  if (entry.mechanism !== undefined) out.mechanism = pickDefined(entry.mechanism, MECHANISM_KEYS);
  const frames = entry.stacktrace?.frames;
  if (Array.isArray(frames)) out.stacktrace = { frames: frames.map(scrubFrame) };
  return out;
}

function scrubTags(tags: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (typeof value === "string" && ALLOWED_TAGS.has(key)) out[key] = value;
  }
  return out;
}

/**
 * `beforeSend` hook: rebuild the event from allowlisted fields only, or return
 * `null` (drop) when it carries no exception. Pure; does not mutate its input.
 */
export function scrubSentryEvent(event: SentryEventLike): SentryEventLike | null {
  const values = event.exception?.values;
  if (!Array.isArray(values) || values.length === 0) return null;

  const out: SentryEventLike = pickDefined(event, SAFE_TOP_LEVEL);
  // Sentry 11 tells ingest whether to infer the end-user IP from the request
  // (sdk.settings.infer_ip). Pinned to "never": contract 3.3 forbids IPs.
  out.sdk = { settings: { infer_ip: "never" } };
  const tags = scrubTags(event.tags);
  if (Object.keys(tags).length > 0) out.tags = tags;
  out.exception = { values: values.map(scrubException) };
  return out;
}
