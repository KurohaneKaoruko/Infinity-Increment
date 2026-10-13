/* Leaderboard API for Cloudflare deployments — one shared module used by both
 * the Pages Function (functions/api/…, onRequestGet/onRequestPost) and the
 * standalone Worker (worker/index.ts, handleGet/handlePost).
 *
 * Same contract as the Node server's /api/leaderboard, backed by a single KV
 * blob instead of a JSON file. Bind a KV namespace as `LEADERBOARD`
 * (Workers: wrangler.jsonc kv_namespaces; Pages: dashboard → Settings →
 * Functions → KV namespace bindings).
 *
 * Read:  GET  /api/leaderboard?limit=20[&device=…]
 * Write: POST /api/leaderboard  { name, era, rank, alpha, transcends, device }
 *
 * No npm dependencies: Cloudflare bundles TypeScript itself, and the shared
 * pure logic comes from ../../server/leaderboard-core.mjs (the same core the
 * Node server uses — server/pages-function.test.ts and
 * server/worker-entry.test.ts pin both adapters to identical behavior).
 */
import {
  isEntry,
  LIMITS,
  toBoardRows,
  upsertBoard,
  validateSubmission,
  type Entry,
} from "../../server/leaderboard-core.mjs";

/* Minimal local types so the project typechecks without installing
 * @cloudflare/workers-types (the real runtime provides richer ones). */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  LEADERBOARD?: KVNamespace;
}

interface FunctionContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

type Handler = (context: FunctionContext) => Promise<Response>;

const BOARD_KEY = "board";
const BODY_LIMIT = 4096;
const NOT_CONFIGURED =
  "leaderboard storage not configured (bind a KV namespace as LEADERBOARD)";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readBoard(env: Env): Promise<Entry[] | null> {
  if (!env.LEADERBOARD) return null; // binding not configured
  const raw = await env.LEADERBOARD.get(BOARD_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data?.entries) ? data.entries.filter(isEntry) : [];
  } catch {
    return []; // corrupt blob -> start clean rather than 500 every request
  }
}

/* Request-level handlers — entry-point agnostic: the Worker entry calls these
 * directly, the Pages adapters below just unwrap the Pages context. */
export async function handleGet(request: Request, env: Env): Promise<Response> {
  const entries = await readBoard(env);
  if (entries === null) return json({ error: NOT_CONFIGURED }, 503);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const device = url.searchParams.get("device") ?? undefined;
  const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 20;
  return json({
    entries: toBoardRows(entries, safeLimit, device),
    total: entries.length,
    generatedAt: Date.now(),
  });
}

export async function handlePost(request: Request, env: Env): Promise<Response> {
  const entries = await readBoard(env);
  if (entries === null) return json({ error: NOT_CONFIGURED }, 503);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > BODY_LIMIT) return json({ error: "payload too large" }, 413);
  const text = await request.text();
  if (text.length > BODY_LIMIT) return json({ error: "payload too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const entry = validateSubmission(parsed, Date.now());
  if (typeof entry === "string") return json({ error: entry }, 400);

  const result = upsertBoard(entries, entry);
  if (result.improved) {
    // KV is eventually consistent: two simultaneous submits can lose one.
    // Acceptable for an honor-system board behind per-IP-limited traffic.
    await env.LEADERBOARD!.put(
      BOARD_KEY,
      JSON.stringify({ entries: result.entries.slice(0, LIMITS.entries) }),
    );
  }
  return json({
    entries: toBoardRows(result.entries, LIMITS.board, entry.device),
    total: result.entries.length,
    generatedAt: Date.now(),
    improved: result.improved,
    submitted: entry,
  });
}

/* Pages Function adapters — keep this module deployable as a Pages route
 * (file-based routing: functions/api/leaderboard.ts -> /api/leaderboard).
 * Workers deployments use worker/index.ts instead; behavior is identical. */
export const onRequestGet: Handler = ({ request, env }) =>
  handleGet(request, env);

export const onRequestPost: Handler = ({ request, env }) =>
  handlePost(request, env);
