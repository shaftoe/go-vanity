# go-vanity

A vanity Go import server as a [Netlify function](https://docs.netlify.com/build/functions/overview/).

Serves the `go-import` / `go-source` meta tags when the Go tool requests
`?go-get=1`, so `go get go.example.com/myrepo` resolves to a repo hosted
elsewhere (e.g. GitHub). Everything else gets a 404. Keeps your import paths
decoupled from your git host.

## Setup

1. Add your domain in Netlify's domain settings.
2. Set the environment variable:

   | Var | Required | Description |
   |---|---|---|
   | `VANITY_TARGET` | see below | Fallback repo host + owner, e.g. `github.com/shaftoe` |
   | `VANITY_REPOS` | see below | Explicit mappings `path=host/org/repo`, comma-separated |
   | `VANITY_BRANCH` | no | Branch used in `go-source` links (default `master`) |
   | `DEBUG` | no | `true` to enable debug logs |

   At least one of `VANITY_TARGET` or `VANITY_REPOS` must be set.
   `VANITY_REPOS` lets a single domain serve repos from multiple owners, e.g.:

   ```
   VANITY_REPOS=runvoy=github.com/runvoy/runvoy,savetoink=github.com/savetoink/savetoink
   ```

   A request path found in `VANITY_REPOS` resolves to that full repo slug;
   anything else falls back to `$VANITY_TARGET/$repo` (or 404s if no fallback
   is configured). Malformed entries are skipped with a warning.

3. Deploy. `netlify.toml` routes `/*` to the function; the module prefix in
   the meta tags is taken from the request URL's host.

## Usage

```
go get go.example.com/myrepo
```

Repo names map 1:1: `go.example.com/myrepo` → `$VANITY_TARGET/myrepo` (unless
overridden by `VANITY_REPOS`, e.g. `go.example.com/runvoy` →
`github.com/runvoy/runvoy`).
Deeper paths (`go.example.com/myrepo/sub/pkg`) resolve to `myrepo`.

## Development

Requires [pnpm](https://pnpm.io).

```shell
pnpm install
pnpm test
pnpm exec tsc --noEmit   # typecheck
```

Local end-to-end testing with the Netlify CLI:

```shell
pnpm dlx netlify-cli dev
curl -s 'http://localhost:8888/myrepo?go-get=1'
```
