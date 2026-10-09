# Admin Console release artifact (RT-337)

The Admin Console ships as a pinned, immutable static bundle. Per the
owner-approved hosting decision in RT-315, Backend-Core's Caddy gateway is
planned to serve it on the same public HTTPS origin as the API (`/` → this
bundle, `/api/*` → Backend-Core). That serving, release and rollback on the host
are owned by RT-336 (Backend-Core) and are **not implemented yet**. This
repository builds and publishes the bundle; it does not deploy it.

## Producing a release

1. Merge to `main` and wait for the **CI** workflow to pass on that push.
2. Run **Release artifact** (`.github/workflows/release-artifact.yml`) from the
   Actions tab with the branch set to `main`.

The workflow refuses to release when:

- it was dispatched from any ref other than `main`;
- CI has no successful `push` run on `main` for that exact commit. CI cancels
  superseded runs, so a commit that was quickly replaced on `main` never gets a
  successful run and cannot be released; release the newer commit;
- `VITE_API_BASE_URL` is set, either in the build environment or in a root
  `.env*` file that `vite build` loads. Vite inlines it into the bundle and would
  replace the same-origin API default;
- `dist/` lacks `index.html` or `assets/`, or contains source maps or `.env*` files;
- a tag or release named `admin-console-<sha12>` already exists. Published
  artifacts are never overwritten.

The owner may additionally enable GitHub's repository-level immutable releases
setting; the workflow does not change repository settings.

## Artifact contract (consumed by RT-336)

Release tag `admin-console-<first 12 chars of the commit SHA>` holds two assets:

| Asset | Content |
| --- | --- |
| `admin-console-<sha12>.tar.gz` | Archive root = the built `dist/`: `index.html`, `assets/`, `version.json` |
| `admin-console-<sha12>.tar.gz.sha256` | `sha256sum` line for the archive |

Serving rules for the host:

| Path | Cache policy |
| --- | --- |
| `/assets/*` | Content-hashed by Vite: `public, max-age=31536000, immutable` |
| `/index.html` and SPA fallback | `no-cache` |
| `/version.json` | `no-cache` (publicly readable) |
| Any other root file | `no-cache` unless it is content-hashed |

`version.json` is public. It contains only:

```json
{
  "app": "retail-tower-console",
  "sha": "<40-char Admin Console commit>",
  "builtAt": "<ISO-8601 UTC build time>",
  "backendContractPin": "<Backend-Core contract pin from openapi-ts.config.ts>"
}
```

No secrets, hostnames, environment values or tenant data belong in the bundle or
in `version.json`.

## Verifying before deployment

```bash
gh release download admin-console-<sha12> --repo Kemetra/Admin-Console
sha256sum -c admin-console-<sha12>.tar.gz.sha256
tar -xzf admin-console-<sha12>.tar.gz -C <pinned-console-dir>
```

Record the deployed pair for every deployment: Admin Console `sha` and
`backendContractPin` from `version.json`, plus the Backend-Core commit and image
digests actually running. The planned rollback (RT-336, not implemented yet) is
re-pointing the host to the previously recorded artifact directory.
