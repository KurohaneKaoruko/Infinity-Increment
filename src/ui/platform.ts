/* Web binding of PlatformStorage — the ONLY place that touches browser
 * storage. Everything in src/core stays platform-free. */
import type { PlatformStorage } from "../core/platform/types";

export class LocalStorage implements PlatformStorage {
  load(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null; // storage unavailable (private mode etc.)
    }
  }

  save(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // quota / unavailable: drop silently, autosave retries later
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
