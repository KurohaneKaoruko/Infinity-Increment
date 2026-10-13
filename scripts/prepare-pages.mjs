/* Prepare the build output for Cloudflare Pages *Direct Upload*.
 *
 * Pages picks up Pages Functions from a `functions/` directory at the root of
 * the uploaded output, so after `npm run build` we copy the repo's functions/
 * next to the assets. (Git-connected Pages projects read functions/ straight
 * from the repository root and do not need this step.)
 *
 *   node scripts/prepare-pages.mjs
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const functions = join(root, "functions");
const target = join(dist, "functions");

if (!existsSync(join(dist, "index.html"))) {
  console.error("prepare-pages: dist/index.html missing — run `npm run build` first");
  process.exit(1);
}
if (!existsSync(functions)) {
  console.error("prepare-pages: functions/ directory missing");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(functions, target, { recursive: true });
console.log(`prepare-pages: copied functions/ → dist/functions/ (${dist})`);
