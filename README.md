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
   | `VANITY_TARGET` | yes | Repo host + owner, e.g. `github.com/shaftoe` |
   | `VANITY_BRANCH` | no | Branch used in `go-source` links (default `master`) |
   | `DEBUG` | no | `true` to enable debug logs |

3. Deploy. `netlify.toml` routes `/*` to the function; the module prefix in
   the meta tags is taken from the request URL's host.

## Usage

```
go get go.example.com/myrepo
```

Repo names map 1:1: `go.example.com/myrepo` → `$VANITY_TARGET/myrepo`.
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
