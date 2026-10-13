/* Platform service boundary (design D5).
 * core code may only ever see these interfaces; concrete bindings
 * (browser storage, filesystem, Steam Cloud) live outside src/core. */

export interface PlatformStorage {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove(key: string): void;
}
