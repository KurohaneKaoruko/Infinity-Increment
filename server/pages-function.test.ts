// @vitest-environment node
/* Pages Function handler tests — the same module Cloudflare deploys, driven
 * with a fake KV namespace and the Node global Request. No wrangler needed.
 * (Kept outside functions/ so it is never bundled as a route.) */
import { describe, it, expect } from "vitest";
import { onRequestGet, onRequestPost } from "../functions/api/leaderboard";

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

const envOf = (kv: FakeKV) => ({ LEADERBOARD: kv });

function get(env: { LEADERBOARD?: FakeKV }, qs = "") {
  return onRequestGet({
    request: new Request(`https://game.example/api/leaderboard${qs}`),
    env,
    params: {},
  });
}

function post(env: { LEADERBOARD?: FakeKV }, body: unknown) {
  return onRequestPost({
    request: new Request("https://game.example/api/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  });
}

const body = (over: Record<string, unknown> = {}) => ({
  name: "云端玩家",
  era: 3,
  rank: "987654321098765432109876543210",
  alpha: "ω^(ω^2)·7 + 13",
  transcends: 12,
  device: "d-cloud01",
  ...over,
});

describe("Pages Function /api/leaderboard", () => {
  it("serves an empty board on a fresh namespace", async () => {
    const res = await get(envOf(fakeKV()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data).toMatchObject({ entries: [], total: 0 });
  });

  it("accepts a submission, persists it to KV, and flags it as self", async () => {
    const kv = fakeKV();
    const res = await post(envOf(kv), body());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.improved).toBe(true);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toMatchObject({ name: "云端玩家", rank: "987654321098765432109876543210", self: true });
    expect(kv.map.has("board")).toBe(true);

    const again = await get(envOf(kv), "?limit=5&device=d-cloud01");
    const board = await again.json();
    expect(board.entries[0].self).toBe(true);
    expect(board.entries[0].device).toBeUndefined(); // device id never echoed
  });

  it("keeps only the best result per device across KV round-trips", async () => {
    const kv = fakeKV();
    await post(envOf(kv), body({ rank: "500" }));
    const worse = await post(envOf(kv), body({ rank: "4", transcends: 99 }));
    expect((await worse.json()).improved).toBe(false);
    const better = await post(envOf(kv), body({ rank: "600" }));
    expect((await better.json()).improved).toBe(true);
    const board = await (await get(envOf(kv))).json();
    expect(board.total).toBe(1);
    expect(board.entries[0].rank).toBe("600");
  });

  it("rejects malformed bodies with 400 and leaves KV untouched", async () => {
    const kv = fakeKV();
    for (const bad of [{}, { ...body(), rank: "12x" }, { ...body(), era: -1 }, null]) {
      const res = await post(envOf(kv), bad);
      expect(res.status).toBe(400);
    }
    expect(kv.map.size).toBe(0);
  });

  it("503s with a readable message when the KV binding is missing", async () => {
    const res = await get({});
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/LEADERBOARD/);
  });

  it("recovers from a corrupt board blob instead of failing every request", async () => {
    const kv = fakeKV({ board: "{not json" });
    const res = await get(envOf(kv));
    expect(res.status).toBe(200);
    expect((await res.json()).entries).toEqual([]);
  });

  it("rejects oversized payloads", async () => {
    const kv = fakeKV();
    const res = await onRequestPost({
      request: new Request("https://game.example/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "99999" },
        body: JSON.stringify(body({ alpha: "x".repeat(5000) })),
      }),
      env: envOf(kv),
      params: {},
    });
    expect(res.status).toBe(413);
  });
});
