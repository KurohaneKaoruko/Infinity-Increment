/* Save codes: single-line portable strings for export/import. */
import { OrdinalError } from "../ordinal/ordinal";
import { migrate } from "./migrations";
import type { SaveData } from "./schema";

export function encodeSave(data: SaveData): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Decodes a save code; throws OrdinalError on any malformed input. */
export function decodeSave(code: string): SaveData {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return migrate(JSON.parse(json));
  } catch (e) {
    if (e instanceof OrdinalError) throw e;
    throw new OrdinalError("save code: malformed");
  }
}
