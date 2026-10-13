/* Save manager: main slot + one rolling backup slot; corrupted payloads
 * fall through to the backup instead of wiping player progress. */
import type { PlatformStorage } from "../platform/types";
import { migrate } from "./migrations";
import type { SaveData } from "./schema";

export class SaveManager {
  constructor(
    private readonly storage: PlatformStorage,
    private readonly key = "infinity.save",
  ) {}

  /** Persist the current state, rotating the previous payload into the backup slot. */
  save(data: SaveData): void {
    const previous = this.storage.load(this.key);
    if (previous !== null) {
      this.storage.save(this.backupKey, previous);
    }
    this.storage.save(this.key, JSON.stringify(data));
  }

  /** Returns the newest readable save (main slot, then backup), or null. */
  load(): SaveData | null {
    for (const key of [this.key, this.backupKey]) {
      const raw = this.storage.load(key);
      if (raw === null) continue;
      try {
        return migrate(JSON.parse(raw));
      } catch {
        // corrupted slot: fall through to the next candidate
      }
    }
    return null;
  }

  private get backupKey(): string {
    return `${this.key}.bak`;
  }
}
