// @vitest-environment node
/* Worker entry tests — the same module `wrangler deploy` bundles, driven with
 * a fake KV namespace and a fake ASSETS fetcher. Handler-level semantics are
 * covered by server/pages-function.test.ts; this file pins the routing layer
 * (API dispatch, 405, SPA fallback, missing binding). */
import { describe, it, expect } from "vitest";
import worker from "../worker/index";

interface FakeKV {
  map: Map<string, string>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

function fakeKV(seed?: Record<string, string>): FakeKV {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => void map.set(key, value),
  };
}

interface FakeAssets {
  calls: string[];
  fetch(input: string | URL | Request): Promise<Response>;
}

function fakeAssets(html: string): FakeAssets {
  const calls: string[] = [];
  return {
    calls,
    fetch: async (input) => {
      calls.push(String(input));
      return new Response(html, { headers: { "content-type": "text/html" } });
    },
  };
}

const envOf = (kv: FakeKV | null, assets: FakeAssets) => ({
  ASSETS: assets,
  ...(kv ? { LEADERBOARD: kv } : {}),
});

const body = {
  name: "Worker 玩家",
  era: 2,
  rank: "314159265358979323846264338327",
  alpha: "ε₀+ω",
  transcends: 7,
  device: "d-worker01",
};

describe("Worker entry routing", () => {
  it("routes /api/leaderboard to the shared API handlers", async () => {
    const kv = fakeKV();
    const res = await worker.fetch(
      new Request("https://game.example/api/leaderboard?limit=5"),
      envOf(kv, fakeAssets("")),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(0);

    const post = await worker.fetch(
      new Request("https://game.example/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      envOf(kv, fakeAssets("")),
    );
    expect((await post.json()).improved).toBe(true);
    expect(kv.map.has("board")).toBe(true);

    const board = await (
      await worker.fetch(
        new Request("https://game.example/api/leaderboard"),
        envOf(kv, fakeAssets("")),
      )
    ).json();
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0].name).toBe("Worker 玩家");
  });

  it("503s when the KV binding is missing", async () => {
    const res = await worker.fetch(
      new Request("https://game.example/api/leaderboard"),
      envOf(null, fakeAssets("")),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/LEADERBOARD/);
  });

  it("405s on unsupported methods for the API path", async () => {
    const res = await worker.fetch(
      new Request("https://game.example/api/leaderboard", { method: "PUT" }),
      envOf(fakeKV(), fakeAssets("")),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("POST");
  });

  it("falls back to index.html for unmatched routes (single-file SPA)", async () => {
    const assets = fakeAssets("<html>GAME</html>");
    const res = await worker.fetch(
      new Request("https://game.example/some/deep/route"),
      envOf(null, assets),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>GAME</html>");
    expect(assets.calls).toEqual(["https://game.example/"]);
    expect(res.headers.get("cache-control")).toBe("no-store"); // HTML shell never cached
  });
});
