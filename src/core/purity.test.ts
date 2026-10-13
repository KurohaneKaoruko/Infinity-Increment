/* Architecture guard (design D5): src/core must stay platform-free.
 * Scans every core source file for browser/global tokens. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTsFiles(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const FORBIDDEN = [/\blocalStorage\b/, /\bwindow\b/, /\bdocument\b/];

describe("core platform purity (3.1)", () => {
  it("src/core contains no platform tokens", () => {
    const files = listTsFiles(join(process.cwd(), "src", "core"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      for (const re of FORBIDDEN) {
        expect(re.test(src), `${f} matches ${re}`).toBe(false);
      }
    }
  });
});
