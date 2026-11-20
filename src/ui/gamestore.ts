/* Reactive bridge between the pure core and Solid UI.
 * Owns: game loop (10tps), autosave, offline settlement, save-code dialog,
 * theme persistence, policy re-choice at every era wall.
 * Operations are all button-driven — no text commands. */
import { createSignal } from "solid-js";
import { initialState, fromSave, toSave, type GameState } from "../core/game/state";
import {
  approach,
  autoPurchase,
  bestMoneyGen,
  buyClickUpgrade,
  buyDriver,
  buyDriverMax,
  buyEraGen,
  buyEraGenMax,
  buyMoneyGen,
  buyMoneyGenMax,
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
  setPolicy,
  tick,
  type GameEvent,
} from "../core/game/engine";
import { settleGameOffline } from "../core/game/offline";
import { usePulse, type PulseMode } from "../core/game/pulse";
import { describeEvent } from "../core/game/log";
import { SaveManager } from "../core/save/manager";
import { encodeSave, decodeSave } from "../core/save/codec";
import type { OfflineReport } from "../core/save/offline";
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
import { PULSE_MONEY_SECONDS, PULSE_PROGRESS_SECONDS, TICK_MS } from "../core/game/config";

const [state, setState] = createSignal<GameState>(initialState(Date.now()));
const [notice, setNoticeText] = createSignal<string | null>(null);
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
// New players start hands-free; an explicit "0" still preserves the opt-out.
const [autoMode, setAutoMode] = createSignal(localStorage.getItem("infinity.autopilot") !== "0");

export { state, notice, offline, axiomPrompt, saveDialog, saveCode, theme };
export { lbStatus, lbBoard, lbBusy, lbName };
export { autoMode };

/** the current era definition */
export const era = () => eraOf(state());
/** 0 → 1 across whatever ladder the player is standing on */
export const progress = () => approach(state());
/** 逼近 ω 的进度(阶梯走完就是 1) */
export const omegaMeter = () => omegaApproach(state());
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
/** 算力构成的逐项拆解(基础 × 检查点 × 周目 × 策略) */
export const incomeParts = () => moneyBreakdown(state());

let manager: SaveManager | null = null;
let booted = false;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function setNotice(text: string | null): void {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer);
  setNoticeText(text);
  if (text !== null) noticeTimer = setTimeout(() => setNoticeText(null), 6500);
}

function mgr(): SaveManager {
  if (!manager) manager = new SaveManager(new LocalStorage());
  return manager;
}

function noticeEvent(events: GameEvent[]): void {
  const lines = events
    .filter((e) => e.kind !== "clicked")
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
  // A hidden tab's timestamp must remain at its last settled simulation state.
  mgr().save(toSave(state(), state().lastSeen));
}

export function toggleAutoMode(): void {
  const next = !autoMode();
  setAutoMode(next);
  localStorage.setItem("infinity.autopilot", next ? "1" : "0");
  setNotice(next ? "自动调度：开" : "自动调度：关");
}

/** Run one pure engine-side automatic-purchase pass. */
function autoSpend(): void {
  const before = state();
  const current = autoPurchase(before);
  if (current !== before) setState({ ...current, lastSeen: Date.now() });
}

function catchUp(s: GameState, now: number): void {
  const result = settleGameOffline(s, now, autoMode());
  setState(result.state);
  if (result.events.some((event) => event.kind === "transcended")) setAxiomPrompt(true);
  if (result.report.seconds >= 60) {
    setOffline(result.report);
  } else if (result.report.seconds >= 5) {
    setNotice(`离线 +${formatMoney(result.report.moneyGain)} 算力`);
  }
}

export function bootGame(): void {
  if (booted) return;
  booted = true;
  applyTheme(theme());

  const loaded = mgr().load();
  if (loaded) {
    catchUp(fromSave(loaded), Date.now());
  } else {
    setState(initialState(Date.now()));
    setNotice("新存档 · 开始");
  }

  let lastTickAt = Date.now();
  let suspendedAt: number | null = document.hidden ? lastTickAt : null;
  setInterval(() => {
    if (suspendedAt !== null || document.hidden) return;
    const now = Date.now();
    const elapsed = now - lastTickAt;
    if (elapsed < 0) {
      lastTickAt = now;
      return;
    }
    // Sleeping tabs cannot silently lose minutes to throttled callbacks.
    if (elapsed >= 5000) {
      catchUp({ ...state(), lastSeen: lastTickAt }, now);
      lastTickAt = now;
      return;
    }
    const ticks = Math.floor(elapsed / TICK_MS);
    if (ticks === 0) return;
    let current = state();
    const events: GameEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      const result = tick(current);
      current = autoMode() ? autoPurchase(result.state) : result.state;
      events.push(...result.events);
    }
    lastTickAt += ticks * TICK_MS;
    advance(current);
    noticeEvent(events);
  }, TICK_MS);

  setInterval(() => { if (suspendedAt === null) saveGame(); }, 15_000);
  window.addEventListener("beforeunload", () => saveGame());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      suspendedAt ??= state().lastSeen;
      saveGame();
    } else if (suspendedAt !== null) {
      const now = Date.now();
      catchUp({ ...state(), lastSeen: suspendedAt }, now);
      suspendedAt = null;
      lastTickAt = now;
      saveGame();
    }
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

export function buyGenMax(tier: number): void {
  const r = buyMoneyGenMax(state(), tier);
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

export function buyEraMax(idx: number): void {
  const r = buyEraGenMax(state(), idx);
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

export function buyRecommended(): void {
  const tier = bestMoneyGen(state());
  if (tier >= 0) buyGen(tier);
}

export function pulseAction(mode: PulseMode): void {
  const before = state();
  const result = usePulse(before, mode);
  if (result.state === before) return;
  advance(result.state);
  if (autoMode()) autoSpend();
  setNotice(mode === "money"
    ? `脉冲补给 +${formatMoney(moneyRate(before).mul(PULSE_MONEY_SECONDS))} 算力`
    : `脉冲推进 · 最多 ${PULSE_PROGRESS_SECONDS} 秒`);
  noticeEvent(result.events);
  saveGame();
}

/** A skipped first strategy choice remains accessible without another era wall. */
export function openPolicyPrompt(): void {
  if (state().phase === "era" && !state().policy) setAxiomPrompt(true);
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

export function choosePolicy(id: string): void {
  advance(setPolicy(state(), id));
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

export function editSaveCode(code: string): void {
  setSaveCode(code);
}

export function confirmImport(code: string): void {
  try {
    const data = decodeSave(code);
    setState({ ...fromSave(data), lastSeen: Date.now() });
    setOffline(null);
    setAxiomPrompt(false);
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
  return `${formatSeconds(r.seconds)} 离线 · +${formatMoney(r.moneyGain)} 算力`;
}
