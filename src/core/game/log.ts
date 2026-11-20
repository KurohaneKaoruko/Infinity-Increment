/* Game events → readable terminal log lines (Chinese). */
import type { GameEvent } from "./engine";

export function describeEvent(e: GameEvent): string | null {
  switch (e.kind) {
    case "mutation":
      return `第 ${e.rung} 级完成 · ${e.name} → ${e.notation}`;
    case "checkpoint":
      return `检查点 · ${e.to} 已解锁`;
    case "waypoint":
      return `航点 · ${e.label}`;
    case "transcended":
      return `进入 ${e.name} · 完成 ${e.wall}`;
    case "bought":
      return `已部署:${e.what}`;
    case "clicked":
      return null; // too frequent for the log
  }
}
