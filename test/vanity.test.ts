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
