/* Reactive bridge between the pure core and Solid UI.
 * Owns: game loop (10tps), autosave, offline settlement, save-code dialog,
 * theme persistence, axiom re-choice at every era wall.
 * Operations are all button-driven — no text commands. */
import { createSignal } from "solid-js";
import { initialState, fromSave, toSave, type GameState } from "../core/game/state";
import {
  absoluteApproach,
  approach,
  buyClickUpgrade,
  buyDriver,
  buyDriverMax,
  buyEraGen,
  buyMoneyGen,
  canBuyDriver,
  click,
  climbValue,
  currentRung,
  driversLeft,
  eraGenCost,
  eraOf,
  moneyBreakdown,
  moneyRate,
  previewMoneyGen,
  nextDriverCost,
  omegaApproach,
  rungFraction,
  rungRate,
  rungReached,
  setAxiom,
  tick,
  type GameEvent,
} from "../core/game/engine";
import { describeEvent } from "../core/game/log";
import { equal } from "../core/ordinal/ordinal";
import { SaveManager } from "../core/save/manager";
import { encodeSave, decodeSave } from "../core/save/codec";
import { settleOffline, type OfflineReport } from "../core/save/offline";
import { LocalStorage } from "./platform";
import {
  deviceId,
  fetchBoard,
  probeServer,
  readName,
  scoreOf,
  sanitizeName,
  submitScore,
  type LeaderboardBoard,
} from "./leaderboard";
import { formatMoney, formatSeconds } from "./format";
import { TICK_MS } from "../core/game/config";

const [state, setState] = createSignal<GameState>(initialState(Date.now()));
const [notice, setNotice] = createSignal<string | null>(null);
const [offline, setOffline] = createSignal<OfflineReport | null>(null);
const [axiomPrompt, setAxiomPrompt] = createSignal(false);
const [saveDialog, setSaveDialog] = createSignal<"export" | "import" | null>(null);
const [saveCode, setSaveCode] = createSignal("");
const [theme, setTheme] = createSignal<"dark" | "light">(
  (localStorage.getItem("infinity.theme") as "dark" | "light" | null) ?? "dark",
);

/* leaderboard — only meaningful on server deployments. probeServer() 404s on
 * static hosts, so the panel stays hidden there. */
export type LbStatus = "hidden" | "loading" | "ready" | "error";
const [lbStatus, setLbStatus] = createSignal<LbStatus>("hidden");
const [lbBoard, setLbBoard] = createSignal<LeaderboardBoard>({ entries: [], total: 0, generatedAt: 0 });
const [lbBusy, setLbBusy] = createSignal(false);
const [lbName, setLbName] = createSignal<string>(readName(localStorage));

export { state, notice, offline, axiomPrompt, saveDialog, saveCode, theme };
export { lbStatus, lbBoard, lbBusy, lbName };

/** the current era definition */
export const era = () => eraOf(state());
/** 0 → 1 across whatever ladder the player is standing on */
export const progress = () => approach(state());
/** 逼近 ω 的进度(阶梯走完就是 1) */
export const omegaMeter = () => omegaApproach(state());
/** 逼近绝对无穷 Ω(永不到达) */
export const absoluteMeter = () => absoluteApproach(state());

/* ---------------- the climb ---------------- */

export const climbing = () => state().phase === "climb";
/** the rung the player is standing on */
export const rung = () => currentRung(state());
/** the position written in the notation the climb has reached */
export const climbText = () => climbValue(state());
/** how full the current rung is (0 → 1) */
export const rungFill = () => rungFraction(state());
/** progress per second at the current rung */
export const climbSpeed = () => rungRate(state());
/** 按当前速度还需多少秒破级(没有机器 → Infinity) */
export const climbEta = (): number => {
  const s = state();
  if (s.phase !== "climb") return Number.POSITIVE_INFINITY;
  const rate = rungRate(s);
  if (rate <= 0) return Number.POSITIVE_INFINITY;
  return (currentRung(s).threshold - s.rungProgress) / rate;
};
/** machines deployed / the rung's limit */
export const machines = () => state().drivers;
export const machineRoom = () => driversLeft(state());
/** price of the next machine */
export const machineCost = () => nextDriverCost(state());
export const machineAffordable = () => canBuyDriver(state());
/** 算力构成的逐项拆解(底数 × 位置桥 × 转生 × 公理) */
export const incomeParts = () => moneyBreakdown(state());

let manager: SaveManager | null = null;
let booted = false;

function mgr(): SaveManager {
  if (!manager) manager = new SaveManager(new LocalStorage());
  return manager;
}

function noticeEvent(events: GameEvent[]): void {
  const lines = events
    .filter((e) => e.kind !== "clicked" && e.kind !== "bought")
    .map(describeEvent)
    .filter((l): l is string => l !== null);
  if (lines.length > 0) setNotice(lines[lines.length - 1]!);
  if (events.some((e) => e.kind === "transcended")) setAxiomPrompt(true);
}

function applyTheme(t: "dark" | "light"): void {
  document.documentElement.dataset.theme = t;
}

export function toggleTheme(): void {
  const t = theme() === "dark" ? "light" : "dark";
  setTheme(t);
  localStorage.setItem("infinity.theme", t);
  applyTheme(t);
}

function advance(next: GameState): void {
  setState({ ...next, lastSeen: Date.now() });
}

function saveGame(): void {
  mgr().save(toSave(state(), Date.now()));
}

function offlineStep(s: GameState): GameState {
  // advance position only; currency is settled in closed form by the report
  const r = tick(s);
  return { ...r.state, money: s.money };
}

export function bootGame(): void {
  if (booted) return;
  booted = true;
  applyTheme(theme());

  const loaded = mgr().load();
  if (loaded) {
    let s = fromSave(loaded);
    const res = settleOffline(s, {
      lastSeen: loaded.lastSeen,
      now: Date.now(),
      step: offlineStep,
      isEqual: (a, b) =>
        equal(a.alpha, b.alpha) && a.rung === b.rung && a.rungProgress === b.rungProgress,
      moneyRate,
    });
    s = { ...res.state, money: res.state.money.add(res.report.moneyGain), lastSeen: Date.now() };
    setState(s);
    if (res.report.seconds >= 60) {
      setOffline(res.report);
    } else if (res.report.moneyGain.gt(0)) {
      setNotice(`离线结算:${formatMoney(res.report.moneyGain)} 货币。`);
    }
  } else {
    setState(initialState(Date.now()));
    setNotice("新存档。从 1 开始,向着无穷。");
  }

  setInterval(() => {
    const r = tick(state());
    advance(r.state);
    noticeEvent(r.events);
  }, TICK_MS);

  setInterval(() => saveGame(), 15_000);
  window.addEventListener("beforeunload", () => saveGame());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveGame();
  });
  void probeLeaderboard();
}

/* ------------------------------------------------------------------ */
/* leaderboard (server deployments)                                    */
/* ------------------------------------------------------------------ */

async function probeLeaderboard(): Promise<void> {
  setLbStatus("loading");
  if (!(await probeServer())) {
    setLbStatus("hidden"); // static deployment: feature absent, UI hides
    return;
  }
  setLbStatus("ready");
  await refreshBoard();
}

export async function refreshBoard(): Promise<void> {
  if (lbStatus() === "hidden") return;
  try {
    setLbBoard(await fetchBoard(20));
    setLbStatus("ready");
  } catch {
    setLbStatus("error");
  }
}

export function renamePlayer(raw: string): void {
  const n = sanitizeName(raw);
  setLbName(n);
  localStorage.setItem("infinity.lb.name", n);
}

export async function submitToLeaderboard(): Promise<void> {
  const s = lbStatus();
  if (s === "hidden" || s === "loading" || lbBusy()) return;
  setLbBusy(true);
  try {
    const sub = scoreOf(state(), lbName(), deviceId(localStorage));
    const board = await submitScore(sub);
    setLbBoard(board);
    setLbStatus("ready");
    const mine = board.entries.find((e) => e.self);
    setNotice(
      board.improved && mine
        ? `个人最佳已上传,当前第 ${board.entries.indexOf(mine) + 1} 名。`
        : board.improved
          ? "已上榜(首条记录)。"
          : "已提交,但未超过你的历史最佳。",
    );
  } catch {
    setLbStatus("error");
    setNotice("排行榜提交失败:网络异常或服务器不可达。");
  } finally {
    setLbBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* Player actions                                                      */
/* ------------------------------------------------------------------ */

export function clickAction(): void {
  const r = click(state());
  advance(r.state);
  noticeEvent(r.events);
}

export function buyGen(tier: number): void {
  const r = buyMoneyGen(state(), tier);
  if (r.events.length > 0) {
    advance(r.state);
    noticeEvent(r.events);
  }
}

/** deploy one machine on the current rung */
export function buyMachine(): void {
  const r = buyDriver(state());
  if (r.events.length > 0) {
    advance(r.state);
    noticeEvent(r.events);
  }
}

/** deploy as many machines as the money allows */
export function buyMachineMax(): void {
  const r = buyDriverMax(state());
  if (r.events.length > 0) {
    advance(r.state);
    noticeEvent(r.events);
  }
}

/** buy one unit of the current era's rung generator */
export function buyEra(idx: number): void {
  const r = buyEraGen(state(), idx);
  if (r.events.length > 0) {
    advance(r.state);
    noticeEvent(r.events);
  }
}

export function buyClick(): void {
  const r = buyClickUpgrade(state());
  if (r.events.length > 0) {
    advance(r.state);
    noticeEvent(r.events);
  }
}

/** is rung idx purchasable right now? (reached + affordable) */
export function eraRungStatus(
  idx: number,
): { locked: boolean; owned: number; cost: number; affordable: boolean } {
  const s = state();
  const owned = s.eraGens[idx] ?? 0;
  const cost = eraGenCost(s, idx);
  return {
    locked: !rungReached(s, idx),
    owned,
    cost,
    affordable: Number.isFinite(cost) && s.money.gte(cost),
  };
}

export function chooseAxiom(id: string): void {
  advance(setAxiom(state(), id));
  setAxiomPrompt(false);
  saveGame();
}

export function dismissAxiomPrompt(): void {
  setAxiomPrompt(false);
}

export function dismissOffline(): void {
  setOffline(null);
}

/* ------------------------------------------------------------------ */
/* Save-code dialog (replaces import/export commands)                  */
/* ------------------------------------------------------------------ */

export function openSaveDialog(mode: "export" | "import"): void {
  setSaveCode(mode === "export" ? encodeSave(toSave(state(), Date.now())) : "");
  setSaveDialog(mode);
}

export function closeSaveDialog(): void {
  setSaveDialog(null);
}

export function confirmImport(code: string): void {
  try {
    const data = decodeSave(code);
    setState(fromSave(data));
    saveGame();
    setNotice("存档码有效,进度已恢复。");
    setSaveDialog(null);
  } catch {
    setNotice("存档码无效,已忽略。");
  }
}

export function copySaveCode(): void {
  const code = saveCode();
  navigator.clipboard
    .writeText(code)
    .then(() => setNotice("存档码已复制到剪贴板。"))
    .catch(() => setNotice("复制失败,请手动选择文本复制。"));
}

export function offlineSummary(r: OfflineReport): string {
  return `离开 ${formatSeconds(r.seconds)},序列自行推进了 ${r.ticksApplied} 步,结算 ${formatMoney(r.moneyGain)} 货币。`;
}
