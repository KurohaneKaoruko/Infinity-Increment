import { createEffect, createSignal, For, Show } from "solid-js";
import {
  state,
  notice,
  offline,
  axiomPrompt,
  saveDialog,
  saveCode,
  theme,
  era,
  approach,
  omegaMeter,
  bootGame,
  clickAction,
  buyGen,
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
import { moneyGenCost, clickUpgradeCost, MONEY_GENS, AXIOMS } from "../core/game/config";
import { moneyRate, clickValue } from "../core/game/engine";
import { STATIC_ERAS } from "../core/game/eras";
import { CODEX } from "./codex";
import BoardPanel from "./BoardPanel";

let booted = false;
export default function App() {
  if (!booted) {
    booted = true;
    bootGame();
  }
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
          <span class="dim">
            {era().name} · 转生 ×{state().transcends}
            {state().axiom ? ` · 公理:${state().axiom}` : ""}
          </span>
          <button class="mini theme-toggle" onClick={toggleTheme} title="切换主题">
            {theme() === "dark" ? "☀ 亮色" : "☾ 暗色"}
          </button>
        </div>
        <div class="alpha-line">
          <span class="dim">α = </span>
          <span class={`alpha ${approach() > 0.85 ? "glitch" : ""}`} data-approach={approach().toFixed(2)}>
            {formatOrd(state().alpha)}
          </span>
          <Show when={approach() >= 0.99}>
            <span class="crit">  [{era().wallName} 临界 —— 表示法正在崩溃]</span>
          </Show>
        </div>
        <div class="meta-line">
          <span class="dim">货币 </span>{formatMoney(state().money)}
          <span class="dim">  ·  产出 {formatMoney(moneyRate(state()))}/s  ·  点击 +{clickValue(state())}</span>
        </div>
      </header>

      <section class="shop panel">
        <div class="panel-title">▍生成器</div>
        <div class="row">
          <button class="fill" onClick={clickAction}>点击 +{clickValue(state())}</button>
          <button class="mini" onClick={() => buyClick()} disabled={state().money.lt(clickUpgradeCost(state().clickLevel))}>
            升级({formatMoney(clickUpgradeCost(state().clickLevel))})
          </button>
        </div>
        <For each={MONEY_GENS}>
          {(g, i) => {
            const count = () => state().gens[i()] ?? 0;
            const cost = () => moneyGenCost(i(), count());
            return (
              <button class="row" onClick={() => buyGen(i())} disabled={state().money.lt(cost())}>
                <span>{g.name} ×{count()}</span>
                <span class="dim">{formatMoney(g.baseRate)}/s</span>
                <span class="cost">{formatMoney(cost())}</span>
              </button>
            );
          }}
        </For>
        <div class="panel-title">▍{era().short} 序列 · 当前纪元({era().gens.length} 级)</div>
        <For each={era().gens}>
          {(g, i) => {
            const st = () => eraRungStatus(i());
            return (
              <Show
                when={!st().locked}
                fallback={<div class="row locked">▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒</div>}
              >
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
              </Show>
            );
          }}
        </For>
      </section>

      <section class="right">
        <div class="stats panel">
          <div class="panel-title">▍纪元仪表</div>
          <div>
            {era().name} → 墙:{era().wallName}
          </div>
          <div class="bar"><div class="bar-fill" style={{ width: `${approach() * 100}%` }} /></div>
          <div class="dim">墙逼近度 {(approach() * 100).toFixed(1)}%</div>
          <div class="wall-desc">{era().wallDesc}</div>
          <div class="omega-row">
            <span class="dim">Ω(绝对无穷)逼近 </span>
            <span class="omega-val">{(omegaMeter() * 100).toFixed(4)}%</span>
            <span class="dim"> —— 永不到达</span>
          </div>
          <EraRoadmap />
          <div class="save-row">
            <button class="mini" onClick={() => openSaveDialog("export")}>导出存档码</button>
            <button class="mini" onClick={() => openSaveDialog("import")}>导入存档码</button>
          </div>
          <Show when={notice()}>
            <div class="notice">{notice()}</div>
          </Show>
        </div>
        <BoardPanel />
        <CodexPanel />
      </section>
    </div>
  );
}

/** the endless chain of notation systems, walked so far */
function EraRoadmap() {
  const idx = () => state().era;
  return (
    <div class="roadmap">
      <div class="panel-title">▍纪元链(无穷)</div>
      <For each={STATIC_ERAS}>
        {(e, i) => (
          <div class="roadmap-item" classList={{ done: i() < idx(), current: i() === idx() }}>
            <span class="dim">{i() < idx() ? "✔" : i() === idx() ? "▸" : "·"}</span> {e.name}
            <span class="dim"> → {e.wallName}</span>
          </div>
        )}
      </For>
      <div class="roadmap-item" classList={{ done: idx() > STATIC_ERAS.length - 1, current: idx() >= STATIC_ERAS.length }}>
        <span class="dim">{idx() >= STATIC_ERAS.length ? "▸" : "·"}</span> 纪元 V+ · 大基数无尽阶梯
        <span class="dim"> → Ω(不可达)</span>
      </div>
    </div>
  );
}

function CodexPanel() {
  const [sel, setSel] = createSignal<string | null>("omega");
  const entry = () => CODEX.find((c) => c.id === sel()) ?? null;
  return (
    <div class="codexpanel panel">
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
