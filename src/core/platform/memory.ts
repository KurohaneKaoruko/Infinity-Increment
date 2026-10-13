/* In-memory PlatformStorage — for tests and as a safe fallback. */
import type { PlatformStorage } from "./types";

export class MemoryStorage implements PlatformStorage {
  private map = new Map<string, string>();

  load(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  save(key: string, value: string): void {
    this.map.set(key, value);
  }

  remove(key: string): void {
    this.map.delete(key);
  }
}
