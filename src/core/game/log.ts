/* Game events → readable terminal log lines (Chinese). */
import type { GameEvent } from "./engine";

export function describeEvent(e: GameEvent): string | null {
  switch (e.kind) {
    case "mutation":
      return `第 ${e.rung} 级「${e.name}」突破 —— ${e.mutation} 数值现在写作 ${e.notation}。旧机器全部报废。`;
    case "converged":
      return `序列收敛,极限到来:${e.to} —— 尾项被吸收。`;
    case "waypoint":
      return `航点抵达:${e.label}`;
    case "transcended":
      return `冲破 ${e.wall} 之墙 —— ${e.name} 开启。旧的天花板,是新纪元的地板。`;
    case "bought":
      return `已部署:${e.what}`;
    case "clicked":
      return null; // too frequent for the log
  }
}
