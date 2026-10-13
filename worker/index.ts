/* Cloudflare Worker entry — deployed by `wrangler deploy` (npm run worker:deploy).
 *
 * Static assets from dist/ are matched by the runtime BEFORE this handler;
 * every request that does not match a file (including /api/leaderboard) lands
 * here. The API handlers are shared with the Pages Function path, so both
 * Cloudflare deployments behave identically.
 */
import { handleGet, handlePost, type Env } from "../functions/api/leaderboard";

/* Minimal asset-fetcher shape — the real runtime provides Fetcher. */
interface Fetcher {
  fetch(input: string | URL | Request): Response | Promise<Response>;
}

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

const API_PATH = "/api/leaderboard";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (new URL(request.url).pathname === API_PATH) {
      if (request.method === "GET" || request.method === "HEAD") {
        return handleGet(request, env);
      }
      if (request.method === "POST") {
        return handlePost(request, env);
      }
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD, POST" },
      });
    }
    // No static file matched: the game is a single-file SPA, so serve the
    // shell for any deep link (no _redirects wildcard needed either).
    // (_headers is a Pages-only feature; the shell served from here must not
    // be cached, mirroring the Node server's HTML no-cache rule.)
    const html = await env.ASSETS.fetch(new URL("/", request.url));
    return new Response(html.body, {
      status: html.status,
      headers: {
        ...Object.fromEntries(html.headers),
        "cache-control": "no-store",
      },
    });
  },
};
