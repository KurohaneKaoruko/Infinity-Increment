import { createSignal, For, Show } from "solid-js";
import {
  state,
  notice,
  offline,
  axiomPrompt,
  saveDialog,
  saveCode,
  theme,
  lbStatus,
  era,
  progress,
  omegaMeter,
  absoluteMeter,
  climbing,
  rung,
  climbText,
  rungFill,
  climbSpeed,
  climbEta,
  machines,
  machineRoom,
  machineCost,
  machineAffordable,
  incomeParts,
  bootGame,
  clickAction,
  buyGen,
  buyMachine,
  buyMachineMax,
  buyEra,
  buyClick,
  chooseAxiom,
  dismissAxiomPrompt,
  dismissOffline,
  toggleTheme,
  openSaveDialog,
  closeSaveDialog,
  confirmImport,
  copySaveCode,
  offlineSummary,
  eraRungStatus,
} from "./gamestore";
import { formatOrd } from "../core/ordinal/format";
import { formatMoney, formatSeconds } from "./format";
import {
  moneyGenCost,
  clickUpgradeCost,
  MONEY_GENS,
  AXIOMS,
  CLICK_UPGRADE,
} from "../core/game/config";
import { moneyRate, clickValue, previewMoneyGen } from "../core/game/engine";
import { CLIMB_RUNGS, CLIMB_LENGTH, FINITE_LAST, FINAL_RUNG, rungArgument, rungArgumentMax } from "../core/game/ops";
import { STATIC_ERAS } from "../core/game/eras";
import { CODEX } from "./codex";
import BoardPanel from "./BoardPanel";

/** Top-level pages — one visible at a time. */
type Tab = "ops" | "shop" | "ladder" | "board" | "codex";

const TABS: { id: Tab; label: string }[] = [
  { id: "ops", label: "运算" },
  { id: "shop", label: "商店" },
  { id: "ladder", label: "阶梯" },
  { id: "board", label: "排行榜" },
  { id: "codex", label: "图鉴" },
];

let booted = false;
export default function App() {
  if (!booted) {
    booted = true;
    bootGame();
  }
  const [tab, setTab] = createSignal<Tab>("ops");
  const positionLabel = () =>
    climbing()
      ? `第 ${rung().n} 级 · ${rung().name}`
      : `${era().name} · 转生 ×${state().transcends}${state().axiom ? ` · 公理:${state().axiom}` : ""}`;
  return (
    <div class="crt">
      <Show when={offline()}>
        {(r) => (
          <div class="modal">
            <div class="panel modal-box">
              <div class="panel-title">▍离线结算</div>
              <p>{offlineSummary(r())}</p>
              <button onClick={dismissOffline}>[ 继续 ]</button>
            </div>
          </div>
        )}
      </Show>
      <Show when={axiomPrompt()}>
        <div class="modal">
          <div class="panel modal-box wide">
            <div class="panel-title">▍公理抉择 —— 每一堵墙后,都可以重写宇宙的规则</div>
            <div class="axiom-row">
              <For each={AXIOMS}>
                {(a) => (
                  <button class="axiom-card" onClick={() => chooseAxiom(a.id)}>
                    <div class="axiom-name">{a.name}</div>
                    <div class="axiom-desc">{a.desc}</div>
                  </button>
                )}
              </For>
            </div>
            <div class="dialog-row">
              <button onClick={dismissAxiomPrompt}>[ 保持现状 ]</button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={saveDialog()}>
        <div class="modal">
          <div class="panel modal-box wide">
            <div class="panel-title">
              ▍{saveDialog() === "export" ? "导出存档码" : "导入存档码"}
            </div>
            <textarea
              class="code-area"
              readonly={saveDialog() === "export"}
              value={saveCode()}
              placeholder={saveDialog() === "import" ? "在此粘贴存档码…" : ""}
              spellcheck={false}
            />
            <div class="dialog-row">
              <Show when={saveDialog() === "export"}>
                <button onClick={copySaveCode}>[ 复制到剪贴板 ]</button>
              </Show>
              <Show when={saveDialog() === "import"}>
                <button onClick={() => confirmImport((saveCode() ?? "").trim())}>[ 导入 ]</button>
              </Show>
              <button onClick={closeSaveDialog}>[ 关闭 ]</button>
            </div>
          </div>
        </div>
      </Show>

      <header class="header panel">
        <div class="header-top">
          <span class="title">INFINITY://terminal</span>
          <span class="dim">{positionLabel()}</span>
          <button class="mini theme-toggle" onClick={toggleTheme} title="切换主题">
            {theme() === "dark" ? "☀ 亮色" : "☾ 暗色"}
          </button>
        </div>
        <div class="alpha-line">
          <span class="dim">{climbing() ? "当前数值 = " : "α = "}</span>
          <span
            class={`alpha ${climbing() && rungFill() > 0.9 ? "glitch" : ""}`}
            data-approach={progress().toFixed(2)}
          >
            {climbing() ? climbText() : formatOrd(state().alpha)}
          </span>
          <Show when={!climbing() && progress() >= 0.99}>
            <span class="crit">  [{era().wallName} 临界 —— 表示法正在崩溃]</span>
          </Show>
        </div>
        <div class="meta-line">
          <span class="dim">算力预算 </span>{formatMoney(state().money)}
          <span class="dim">  ·  产出 {formatMoney(moneyRate(state()))}/s  ·  手点 +{clickValue(state())}</span>
        </div>
        <Show when={notice()}>
          <div class="notice">{notice()}</div>
        </Show>
        <nav class="tabs">
          <For each={TABS}>
            {(t) => (
              <Show when={t.id !== "board" || lbStatus() !== "hidden"}>
                <button
                  class="tab"
                  classList={{ active: tab() === t.id }}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              </Show>
            )}
          </For>
        </nav>
      </header>

      <div class="content">
        <Show when={tab() === "ops"}>
          <Show when={climbing()} fallback={<EraOpsPanel />}>
            <ClimbPanel />
          </Show>
        </Show>

        <Show when={tab() === "shop"}>
          <ShopPanel />
        </Show>

        <Show when={tab() === "ladder"}>
          <section class="page panel">
            <div class="panel-title">▍阶梯全景 —— 一级一种记号</div>
            <LadderStrip />
            <div class="panel-title">▍仪表</div>
            <div class="omega-row">
              <span class="dim">逼近 ω </span>
              <span class="omega-val">{(omegaMeter() * 100).toFixed(2)}%</span>
              <span class="dim"> —— 走完有限 {FINITE_LAST} 级就是它</span>
            </div>
            <div class="omega-row">
              <span class="dim">逼近 Ω(绝对无穷) </span>
              <span class="omega-val">{(absoluteMeter() * 100).toFixed(6)}%</span>
              <span class="dim"> —— 永不到达</span>
            </div>
            <EraRoadmap />
          </section>
        </Show>

        <Show when={tab() === "board"}>
          <BoardPanel />
        </Show>

        <Show when={tab() === "codex"}>
          <CodexPanel />
        </Show>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 运算 · 阶梯                                                          */
/* ------------------------------------------------------------------ */

function ClimbPanel() {
  const r = () => rung();
  const frac = () => rungFill();
  return (
    <section class="page panel">
      <div class="panel-title">
        ▍运算阶梯 · 第 {r().n} 级 / {CLIMB_LENGTH} —— {r().name} {r().phase === "finite" ? "(有限)" : "(ω 之后)"}
      </div>

      <div class="climb-value">{climbText()}</div>
      <div class="dim">
        进度单位「{r().unit}」 · {rungArgument(r().n, state().rungProgress).toLocaleString()} /{" "}
        {rungArgumentMax(r().n).toLocaleString()}
      </div>
      <div class="bar">
        <div class="bar-fill" style={{ width: `${frac() * 100}%` }} />
      </div>
      <div class="dim">
        这一级已填 {(frac() * 100).toFixed(1)}% · 推进 +{climbSpeed().toFixed(2)} {r().unit}/s
        <Show when={Number.isFinite(climbEta())}>
          {" · "}按当前速度还需 {formatSeconds(climbEta())} 破级
        </Show>
      </div>

      <div class="hint">
        <b>这一级在算什么:</b>
        {r().what}
      </div>

      <div class="row">
        <button class="fill" disabled={!machineAffordable()} onClick={buyMachine}>
          部署机器 {machines()}/{r().maxDrivers} · {formatMoney(machineCost())} 算力
        </button>
        <button class="mini" disabled={!machineAffordable()} onClick={buyMachineMax}>
          [ 全部部署 ]
        </button>
      </div>
      <div class="dim">
        还能放 {machineRoom()} 台 · 每台 +{r().rate} {r().unit}/s
      </div>
      <div class="hint">
        <b>为什么机器会消失:</b>
        机器只服务当前这一级。破级时它们<b>全部报废</b> —— 上一级的机器算不动新一级的数。
        货币不参与运算,它只是算力预算:决定你能同时部署几台机器。
      </div>
      <div class="hint">
        <b>破级时数值不会倒退:</b>
        计数是<b>跨级连续</b>的 —— 破级只换「施加哪种运算」,不重置计数。
        上一级数到哪,下一级就从哪接着算,所以读数只增不减。
      </div>

      <div class="mutation-preview">
        <div>
          <span class="dim">▸ 破级突变 </span>
          {r().mutation}
        </div>
        <div>
          <span class="dim">▸ 破级之后数值改写作 </span>
          <b>{r().nextNotation}</b>
          <Show when={r().n === FINAL_RUNG}>
            <span class="dim"> —— 从此进入纪元链,记号由二元 Veblen φ 换成 Madore ψ</span>
          </Show>
        </div>
      </div>

      <div class="panel-title">▍{CLIMB_LENGTH} 级全景</div>
      <LadderStrip />
    </section>
  );
}

/** 走完阶梯之后:纪元链的操作页 */
function EraOpsPanel() {
  return (
    <section class="page panel">
      <div class="panel-title">▍{era().short} 序列 · 当前纪元({era().gens.length} 级)</div>
      <div class="dim">
        你已经在 ω 之外。这里每一级都是本纪元的极限序数 —— 把它的系数填满,极限就会交付下一级。
      </div>
      <For each={era().gens}>
        {(g, i) => {
          const st = () => eraRungStatus(i());
          const unitTerm = () => formatOrd([g.increment(state().alpha, 1)]);
          const ownedTerm = () =>
            st().owned > 0 ? formatOrd([g.increment(state().alpha, st().owned)]) : "0";
          return (
            <Show
              when={!st().locked}
              fallback={<div class="row locked">▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒</div>}
            >
              <div class="shop-item">
              <button
                class="row alpha"
                classList={{ own: st().owned > 0 }}
                onClick={() => buyEra(i())}
                disabled={!st().affordable}
              >
                <span>{g.name}{st().owned > 0 ? ` ×${st().owned}` : ""}</span>
                <span class="dim">{g.wall ? "墙" : g.waypoint ? "航点" : ""}</span>
                <span class="cost">{formatMoney(st().cost)}</span>
              </button>
              <div class="shop-note">
                <div><b>做什么:</b> 用 {g.name} 推进当前纪元的序数序列。</div>
                <div><b>效果:</b> 每台每 tick 向 α 加入 {unitTerm()}；当前 {st().owned} 台合计贡献 {ownedTerm()}。</div>
                <div><b>用途:</b> 累积到当前梯级的收敛阈值后交付下一阶；{g.wall ? `突破本纪元的 ${era().wallName} 之墙。` : g.waypoint ? `继续推进至航点「${g.waypoint}」。` : "逐级提高可表示的序数范围。"}</div>
              </div>
              </div>
            </Show>
          );
        }}
      </For>
      <div class="hint">
        <b>这里为什么没有机器:</b>
        纪元链的位置是<b>累加</b>出来的 —— 每一级生成器每个 tick 都把自己的项加进 α。
        生成的项越大,α 增长越快;填满系数,极限就到手。
      </div>
    </section>
  );
}

/** 阶梯一览 */
function LadderStrip() {
  const finished = () => state().phase === "era";
  return (
    <div class="ladder">
      <For each={CLIMB_RUNGS}>
        {(r) => {
          const done = () => finished() || r.n < state().rung;
          const current = () => !finished() && r.n === state().rung;
          return (
            <div class="ladder-rung" classList={{ done: done(), current: current() }}>
              <span class="ladder-n">{String(r.n).padStart(2, "0")}</span>
              <span class="ladder-glyph">{r.glyph}</span>
              <span class="ladder-name">
                {r.name}
                <span class="dim"> → {r.nextNotation}</span>
              </span>
              <span class="ladder-mark">{done() ? "✔" : current() ? "▸" : "·"}</span>
            </div>
          );
        }}
      </For>
      <div class="dim">
        前 {FINITE_LAST} 级是有限超运算 —— 一路到「高德纳箭头也写不下」;之后{" "}
        {CLIMB_LENGTH - FINITE_LAST} 级是同一个阶梯架在 ω 上,终点是 Γ₀。
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 商店                                                                */
/* ------------------------------------------------------------------ */

function ShopPanel() {
  return (
    <section class="page panel">
      <div class="panel-title">▍货币生成器 · 算力预算</div>
      <div class="dim">
        货币不改变你的数值,它买的是<b>机器</b>。产出越高,同一级能同时部署的机器越多。
      </div>
      <div class="income-parts">
        <div>
          底数 {incomeParts().base.toFixed(2)}/s
          <span class="dim"> (全部机器之和)</span>
        </div>
        <div>
          × 位置桥 {formatMoney(incomeParts().position)}
          <span class="dim">
            {" "}
            {climbing() ? "(每破一级 ×16,一级之内再抬到 ×1.5)" : "(由 α 的量级决定)"}
          </span>
        </div>
        <div>× 转生 {incomeParts().prestige} × 公理 {incomeParts().axiom}</div>
        <div class="income-total">= 总产出 {formatMoney(incomeParts().total)}/s</div>
      </div>
      <For each={MONEY_GENS}>
        {(g, i) => {
          const count = () => state().gens[i()] ?? 0;
          const cost = () => moneyGenCost(i(), count());
          const next = () => state().gens[i() + 1] ?? 0;
          const preview = () => previewMoneyGen(state(), i());
          return (
            <div class="shop-item">
              <button class="row" onClick={() => buyGen(i())} disabled={state().money.lt(cost())}>
                <span>
                  {g.name} ×{count()}
                </span>
                <span class="dim">+{formatMoney(preview().increase)}/s</span>
                <span class="cost">{formatMoney(cost())}</span>
              </button>
              <div class="shop-note">
                <div><b>做什么:</b> {g.what}</div>
                <div><b>效果:</b> {g.affects}；当前产出 {formatMoney(preview().current)}/s → 购买后 {formatMoney(preview().afterPurchase)}/s（实际 +{formatMoney(preview().increase)}/s）</div>
                <div><b>用途:</b> {g.why}</div>
                <Show when={next() > 0}>
                  <div class="dim">当前被上层 {next()} 台放大 ×{(1 + 0.25 * next()).toFixed(2)}</div>
                </Show>
              </div>
            </div>
          );
        }}
      </For>

      <div class="panel-title">▍手动算力</div>
      <div class="shop-item">
        <button
          class="row"
          onClick={() => buyClick()}
          disabled={state().money.lt(clickUpgradeCost(state().clickLevel))}
        >
          <span>{CLICK_UPGRADE.name} Lv.{state().clickLevel}</span>
          <span class="dim">+{clickValue(state())}/次</span>
          <span class="cost">{formatMoney(clickUpgradeCost(state().clickLevel))}</span>
        </button>
        <div class="shop-note">
          <div><b>做什么:</b> {CLICK_UPGRADE.what}</div>
          <div><b>效果:</b> 每次点击 {clickValue(state())} → {clickValue({ ...state(), clickLevel: state().clickLevel + 1 })} 货币（+{clickValue({ ...state(), clickLevel: state().clickLevel + 1 }) - clickValue(state())}/次）</div>
          <div><b>影响:</b> {CLICK_UPGRADE.affects}</div>
          <div><b>用途:</b> {CLICK_UPGRADE.why}</div>
        </div>
      </div>

      <div class="panel-title">▍存档</div>
      <div class="save-row">
        <button class="mini" onClick={() => openSaveDialog("export")}>导出存档码</button>
        <button class="mini" onClick={() => openSaveDialog("import")}>导入存档码</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 阶梯 · 纪元链                                                        */
/* ------------------------------------------------------------------ */

/** the endless chain of notation systems, walked so far */
function EraRoadmap() {
  const idx = () => state().era;
  const climbingNow = () => state().phase === "climb";
  return (
    <div class="roadmap">
      <div class="panel-title">▍纪元链(无穷)</div>
      <div class="roadmap-item" classList={{ current: climbingNow() }}>
        <span class="dim">{climbingNow() ? "▸" : "✔"}</span> 运算阶梯 · 1 → ω → Γ₀
        <span class="dim"> → Γ₀</span>
      </div>
      <For each={STATIC_ERAS.slice(1)}>
        {(e, i) => {
          const n = i() + 1;
          return (
            <div class="roadmap-item" classList={{ done: n < idx(), current: !climbingNow() && n === idx() }}>
              <span class="dim">{n < idx() ? "✔" : n === idx() && !climbingNow() ? "▸" : "·"}</span> {e.name}
              <span class="dim"> → {e.wallName}</span>
            </div>
          );
        }}
      </For>
      <div
        class="roadmap-item"
        classList={{
          done: idx() > STATIC_ERAS.length - 1,
          current: !climbingNow() && idx() >= STATIC_ERAS.length,
        }}
      >
        <span class="dim">{!climbingNow() && idx() >= STATIC_ERAS.length ? "▸" : "·"}</span> 纪元 IV+ ·
        大基数无尽阶梯
        <span class="dim"> → Ω(不可达)</span>
      </div>
    </div>
  );
}

function CodexPanel() {
  const [sel, setSel] = createSignal<string | null>("omega");
  const entry = () => CODEX.find((c) => c.id === sel()) ?? null;
  return (
    <div class="codexpanel panel page">
      <div class="panel-title">▍图鉴(点击术语查看)</div>
      <div class="codex-list">
        <For each={CODEX}>
          {(c) => (
            <button
              class="mini codex-term"
              classList={{ active: sel() === c.id }}
              onClick={() => setSel(c.id)}
            >
              {c.title}
            </button>
          )}
        </For>
      </div>
      <Show when={entry()}>
        {(e) => <div class="codex-text">{e().text}</div>}
      </Show>
    </div>
  );
}
