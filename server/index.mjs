/* INFINITY // terminal — server deployment.
 *
 * One process does two jobs:
 *   1. serves the single-file web build from ./dist (same code as any static
 *      host — no behavioral difference for the game itself), and
 *   2. exposes the leaderboard API under /api/leaderboard.
 *
 * Static deployments stay fully supported: point any static host at dist/ and
 * the game's leaderboard panel hides itself (the probe 404s).
 *
 * Zero npm dependencies — node:http only.
 *
 *   PORT=8787 DATA_DIR=./server/data node server/index.mjs
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, LIMITS, validateSubmission } from "./leaderboard.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = process.env.DIST_DIR ? resolve(process.env.DIST_DIR) : join(ROOT, "dist");
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(ROOT, "server", "data");
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const BODY_LIMIT = 4096;

const store = createStore(DATA_DIR);

/* ---------------------------------------------------------------- */
/* rate limiting: per-IP sliding window on submissions               */
/* ---------------------------------------------------------------- */

const RATE = { windowMs: 60_000, max: 6, minGapMs: 3000 };
const hits = new Map(); // ip -> number[] (submit timestamps)

function rateLimited(ip, now) {
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  if (list.length >= RATE.max) {
    hits.set(ip, list);
    return true;
  }
  if (list.length > 0 && now - list[list.length - 1] < RATE.minGapMs) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  // opportunistic cleanup so the map cannot grow without bound
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.length === 0) hits.delete(k);
  }
  return false;
}

/* ---------------------------------------------------------------- */
/* helpers                                                           */
/* ---------------------------------------------------------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        rejectPromise(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectPromise);
  });
}

function ipOf(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

/* ---------------------------------------------------------------- */
/* static hosting of dist/                                           */
/* ---------------------------------------------------------------- */

function resolveDistPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const rel = normalize(clean).replace(/^([/\\])+/, "");
  if (rel.includes("..")) return null;
  const abs = join(DIST, rel);
  if (abs !== DIST && !abs.startsWith(DIST + sep)) return null;
  return abs;
}

function serveStatic(req, res, urlPath) {
  if (!existsSync(DIST)) {
    sendJson(res, 503, { error: "dist not built — run `npm run build` first" });
    return;
  }
  let file = resolveDistPath(urlPath);
  if (file === null) {
    sendJson(res, 400, { error: "bad path" });
    return;
  }
  let isIndex = false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(DIST, "index.html"); // SPA fallback
    isIndex = true;
    if (!existsSync(file)) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
  }
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    // the shell must revalidate so deploys propagate; assets are content-hashed
    // by none here (single-file build), so a short cache is the safe choice
    "cache-control": isIndex || type.startsWith("text/html") ? "no-cache" : "public, max-age=300",
  });
  createReadStream(file).pipe(res);
}

/* ---------------------------------------------------------------- */
/* API                                                               */
/* ---------------------------------------------------------------- */

async function handleApi(req, res, path) {
  const url = new URL(req.url, "http://localhost");
  if (path === "/api/health") {
    sendJson(res, 200, { ok: true, entries: store.load().length });
    return;
  }
  if (path !== "/api/leaderboard") {
    sendJson(res, 404, { error: "unknown endpoint" });
    return;
  }

  if (req.method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const device = url.searchParams.get("device") ?? undefined;
    const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 20;
    sendJson(res, 200, store.board(safeLimit, device));
    return;
  }

  if (req.method === "POST") {
    const ip = ipOf(req);
    if (rateLimited(ip, Date.now())) {
      sendJson(res, 429, { error: "提交太频繁,请稍后再试" });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }
    const entry = validateSubmission(parsed, Date.now());
    if (typeof entry === "string") {
      sendJson(res, 400, { error: entry });
      return;
    }
    const result = store.submit(entry);
    const board = store.board(LIMITS.board, entry.device);
    sendJson(res, 200, { ...board, improved: result.improved, submitted: result.entry });
    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}

/* ---------------------------------------------------------------- */
/* server                                                            */
/* ---------------------------------------------------------------- */

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  try {
    if (path.startsWith("/api/")) {
      await handleApi(req, res, path);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    serveStatic(req, res, path);
  } catch (err) {
    sendJson(res, 500, { error: `server error: ${err instanceof Error ? err.message : String(err)}` });
  }
});

server.listen(PORT, HOST, () => {
  const where = existsSync(DIST) ? DIST : "(缺失 —— 先 npm run build)";
  console.log(`INFINITY // terminal server`);
  console.log(`  web      http://${HOST}:${PORT}/  → ${where}`);
  console.log(`  board    http://${HOST}:${PORT}/api/leaderboard?limit=20`);
  console.log(`  store    ${store.file}`);
});
