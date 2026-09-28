// Vanity Go import server as a Netlify function.
//
// Env vars:
//   VANITY_TARGET  fallback repo host + owner, e.g. "github.com/shaftoe"
//   VANITY_REPOS   optional explicit mappings "path=host/org/repo,..." that
//                  override the VANITY_TARGET fallback per repo
//   VANITY_BRANCH  optional, default "master" (only used for go-source links)
//
// LOG_LEVEL / logging: Netlify captures console output automatically.

const contentTypePlain = "text/plain; charset=utf-8";

// Parse VANITY_REPOS: comma-separated "path=host/org/repo" tuples.
// Malformed entries are skipped with a warning.
const parseRepos = (raw: string | undefined): Record<string, string> => {
  const repos: Record<string, string> = {};
  for (const tuple of raw?.split(",") ?? []) {
    if (!tuple) continue;
    const eq = tuple.indexOf("=");
    if (eq <= 0 || eq === tuple.length - 1) {
      console.warn(JSON.stringify({ msg: "ignoring malformed VANITY_REPOS entry", entry: tuple }));
      continue;
    }
    repos[tuple.slice(0, eq).trim()] = tuple.slice(eq + 1).trim();
  }
  return repos;
};

const plain = (status: number, body: string): Response =>
  new Response(body, { status, headers: { "content-type": contentTypePlain } });

const debug = (obj: Record<string, unknown>): void => {
  if (process.env.DEBUG === "true") console.log(JSON.stringify(obj));
};

export default async (req: Request): Promise<Response> => {
  const target = process.env.VANITY_TARGET;
  const repos = parseRepos(process.env.VANITY_REPOS);
  const branch = process.env.VANITY_BRANCH ?? "master";

  if (req.method !== "GET" && req.method !== "HEAD") {
    debug({ msg: "method not allowed", method: req.method });
    return plain(405, "method not allowed\n");
  }
  if (!target && Object.keys(repos).length === 0) {
    console.error(JSON.stringify({ msg: "VANITY_TARGET not set" }));
    return plain(500, "VANITY_TARGET not set\n");
  }

  const url = new URL(req.url);
  const host = url.hostname;
  // Repo is the first path segment; deeper segments are packages within it.
  const repo = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/")[0];
  if (!repo) {
    debug({ msg: "no repo in path", path: url.pathname });
    return plain(404, "not found\n");
  }

  // Only the Go tool (or curious humans) asking for meta tags get HTML;
  // everything else 404s, per spec.
  if (url.searchParams.get("go-get") !== "1") {
    debug({ msg: "non go-get request", method: req.method, path: url.pathname });
    return plain(404, "not found\n");
  }

  const module = `${host}/${repo}`;
  const vcsUrl = repos[repo] ?? (target ? `${target}/${repo}` : null);
  if (!vcsUrl) {
    debug({ msg: "repo not mapped and no VANITY_TARGET", repo });
    return plain(404, "not found\n");
  }
  const body = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="go-import" content="${module} git https://${vcsUrl}">
<meta name="go-source" content="${module} https://${vcsUrl} https://${vcsUrl}/tree/${branch}{/dir} https://${vcsUrl}/blob/${branch}{/dir}/{file}#L{line}">
</head>
<body>
go get ${module}
</body>
</html>
`;
  debug({ msg: "serving go-import meta", module, "vcs-url": vcsUrl });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

export const config = {
  path: "/*",
};
