import { describe, expect, it } from "vitest";
import handler from "../netlify/functions/vanity.ts";

const withEnv = async <T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> => {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

describe("vanity handler", () => {
  it("serves go-import meta tags", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/boneclone?go-get=1"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain(
        'go-import" content="go.shaftoe.dev/boneclone git https://github.com/shaftoe/boneclone"',
      );
      expect(body).toContain("/tree/master{/dir}");
    });
  });

  it("resolves subpackage paths to the repo root", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/boneclone/pkg/deep?go-get=1"));
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('content="go.shaftoe.dev/boneclone git');
    });
  });

  it("honours VANITY_BRANCH", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe", VANITY_BRANCH: "main" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/repo?go-get=1"));
      expect(await res.text()).toContain("/tree/main{/dir}");
    });
  });

  it("resolves explicit VANITY_REPOS mappings", async () => {
    await withEnv(
      {
        VANITY_TARGET: "github.com/shaftoe",
        VANITY_REPOS: "runvoy=github.com/runvoy/runvoy,savetoink=github.com/savetoink/savetoink",
      },
      async () => {
        const res = await handler(new Request("https://go.example.com/savetoink?go-get=1"));
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain(
          'go-import" content="go.example.com/savetoink git https://github.com/savetoink/savetoink"',
        );
        expect(body).toContain("https://github.com/savetoink/savetoink/tree/master{/dir}");
      },
    );
  });

  it("falls back to VANITY_TARGET for unmapped repos", async () => {
    await withEnv(
      { VANITY_TARGET: "github.com/shaftoe", VANITY_REPOS: "runvoy=github.com/runvoy/runvoy" },
      async () => {
        const res = await handler(new Request("https://go.example.com/boneclone?go-get=1"));
        expect(await res.text()).toContain(
          'git https://github.com/shaftoe/boneclone"',
        );
      },
    );
  });

  it("works with only VANITY_REPOS and 404s unmapped repos", async () => {
    await withEnv({ VANITY_REPOS: "runvoy=github.com/runvoy/runvoy" }, async () => {
      const ok = await handler(new Request("https://go.example.com/runvoy?go-get=1"));
      expect(ok.status).toBe(200);
      expect(await ok.text()).toContain("https://github.com/runvoy/runvoy");

      const miss = await handler(new Request("https://go.example.com/other?go-get=1"));
      expect(miss.status).toBe(404);
    });
  });

  it("ignores malformed VANITY_REPOS entries", async () => {
    await withEnv({ VANITY_REPOS: "broken,:bogus,ok=github.com/o/ok" }, async () => {
      const res = await handler(new Request("https://go.example.com/ok?go-get=1"));
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("https://github.com/o/ok");
    });
  });

  it("404s human traffic", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/boneclone"));
      expect(res.status).toBe(404);
    });
  });

  it("404s the root path", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/?go-get=1"));
      expect(res.status).toBe(404);
    });
  });

  it("405s non-GET/HEAD", async () => {
    await withEnv({ VANITY_TARGET: "github.com/shaftoe" }, async () => {
      const res = await handler(new Request("https://go.shaftoe.dev/x", { method: "POST" }));
      expect(res.status).toBe(405);
    });
  });

  it("500s without VANITY_TARGET", async () => {
    await withEnv({ VANITY_TARGET: "" }, async () => {
      delete process.env.VANITY_TARGET;
      const res = await handler(new Request("https://h/x?go-get=1"));
      expect(res.status).toBe(500);
    });
  });
});
