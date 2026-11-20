import { createMemo, createSignal, For, Show } from "solid-js";
import {
  state,
  notice,
  offline,
  axiomPrompt,
  saveDialog,
  saveCode,
  theme,
  autoMode,
  lbStatus,
  era,
  progress,
  omegaMeter,
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
  buyGenMax,
  buyMachine,
  buyMachineMax,
  buyEra,
  buyEraMax,
  buyClick,
  buyRecommended,
  pulseAction,
  openPolicyPrompt,
  choosePolicy,
  dismissAxiomPrompt,
  dismissOffline,
  toggleTheme,
  toggleAutoMode,
  openSaveDialog,
  closeSaveDialog,
  confirmImport,
  copySaveCode,
  editSaveCode,
  offlineSummary,
  eraRungStatus,
} from "./gamestore";
import { formatOrd } from "../core/ordinal/format";
import { formatMoney, formatSeconds } from "./format";
import {
  moneyGenCost,
  clickUpgradeCost,
  MONEY_GENS,
  PULSE_COST_TICKS,
  PULSE_MAX_CHARGES,
  PULSE_PROGRESS_SECONDS,
  PULSE_MONEY_SECONDS,
  RUN_POLICIES,
  runPolicy,
} from "../core/game/config";
import { bestMoneyGen, checkpointEta, eraFrontier, moneyRate, clickValue, previewMoneyGen, stageThreshold } from "../core/game/engine";
import { canUsePulse, pulseCharges, pulseReadyIn } from "../core/game/pulse";
import {
  CLIMB_RUNGS,
  CLIMB_LENGTH,
  FINITE_LAST,
  FINAL_RUNG,
  rungArgument,
  rungArgumentMax,
} from "../core/game/ops";
import { STATIC_ERAS } from "../core/game/eras";
import { CODEX } from "./codex";
import BoardPanel from "./BoardPanel";
import { affordIn, compactClimbValue } from "./gameview";

type Tab = "ops" | "shop" | "ladder" | "board" | "codex";

const TABS: { id: Tab; label: string }[] = [
  { id: "ops", label: "运算" },
  { id: "shop", label: "商店" },
  { id: "ladder", label: "路线" },
  { id: "board", label: "排行榜" },
  { id: "codex", label: "图鉴" },
];

let booted = false;

function focusDialog(element: HTMLDivElement): void {
  queueMicrotask(() => {
    if (element.isConnected) element.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  });
}

function dialogKeydown(event: KeyboardEvent, close: () => void): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "Tab") {
    const dialog = event.currentTarget as HTMLDivElement;
    const targets = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input, summary")]
      .filter((element) => element.getClientRects().length > 0);
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (first && last && event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (first && last && !event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

export default function App() {
  if (!booted) {
    booted = true;
    bootGame();
  }
  const [tab, setTab] = createSignal<Tab>("ops");
  const dialogOpen = () => Boolean(offline() || axiomPrompt() || saveDialog());
  const positionLabel = () =>
    climbing()
      ? `第 ${rung().n} 级 · ${rung().name}`
      : `${era().name} · 周目 ${state().transcends}${runPolicy(state().policy) ? ` · ${runPolicy(state().policy)!.name}` : ""}`;

  return (
    <div class="crt">
      <Show when={offline()}>
        {(report) => (
          <div class="modal" role="dialog" aria-modal="true" aria-label="离线收益" ref={focusDialog} onKeyDown={(event) => dialogKeydown(event, dismissOffline)}>
            <div class="panel modal-box compact-modal">
              <div class="modal-head">
                <span class="eyebrow">离线收益</span>
                <button class="mini" onClick={dismissOffline}>关闭</button>
              </div>
              <div class="offline-gain">{offlineSummary(report())}</div>
              <details class="utility-block">
                <summary>结算规则</summary>
                <p>收益 50% · 最多 24 小时；路线与自动采购最多模拟 1 小时。收益含自动采购已花费的算力。</p>
              </details>
              <button class="primary-action full" onClick={dismissOffline}>继续</button>
            </div>
          </div>
        )}
      </Show>

      <Show when={axiomPrompt() && !offline() && !saveDialog()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="选择策略" ref={focusDialog} onKeyDown={(event) => dialogKeydown(event, dismissAxiomPrompt)}>
          <div class="panel modal-box compact-modal">
            <div class="modal-head">
              <div>
                <div class="eyebrow">新周目</div>
                <h2>选择策略</h2>
              </div>
              <button class="mini" onClick={dismissAxiomPrompt}>稍后</button>
            </div>
            <div class="policy-grid">
              <For each={RUN_POLICIES}>
                {(policy) => (
                  <button
                    class="policy-option"
                    title={policy.desc}
                    onClick={() => choosePolicy(policy.id)}
                  >
                    <strong>{policy.name}</strong>
                    <span>货币 ×{policy.moneyMult}</span>
                    <span>门槛 ×{policy.thresholdMult}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      <Show when={saveDialog()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="存档" ref={focusDialog} onKeyDown={(event) => dialogKeydown(event, closeSaveDialog)}>
          <div class="panel modal-box compact-modal">
            <div class="modal-head">
              <span class="eyebrow">{saveDialog() === "export" ? "导出存档" : "导入存档"}</span>
              <button class="mini" onClick={closeSaveDialog}>关闭</button>
            </div>
            <textarea
              class="code-area"
              aria-label="存档码"
              readonly={saveDialog() === "export"}
              value={saveCode()}
              onInput={(event) => editSaveCode(event.currentTarget.value)}
              placeholder={saveDialog() === "import" ? "粘贴存档码" : ""}
              spellcheck={false}
            />
            <div class="dialog-row">
              <Show when={saveDialog() === "export"}>
                <button onClick={copySaveCode}>复制</button>
              </Show>
              <Show when={saveDialog() === "import"}>
                <button class="primary-action" onClick={() => confirmImport(saveCode().trim())}>导入</button>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      <header class="header panel" inert={dialogOpen()}>
        <div class="header-top">
          <div class="brand">
            <span class="title">INFINITY</span>
            <span class="brand-sub">// terminal</span>
          </div>
          <span class="route-chip">{positionLabel()}</span>
          <button class="mini theme-toggle" onClick={toggleTheme} title="切换主题" aria-label="切换主题">
            {theme() === "dark" ? "☀" : "☾"}
          </button>
        </div>
        <div class="resource-strip">
          <div class="resource-main">
            <span class="eyebrow">算力</span>
            <strong>{formatMoney(state().money)}</strong>
            <span class="rate">+{formatMoney(moneyRate(state()))}/s</span>
          </div>
          <button class="quick-action" onClick={clickAction}>
            +{clickValue(state())} <span>手算</span>
          </button>
          <button
            class="auto-button"
            classList={{ active: autoMode() }}
            aria-pressed={autoMode()}
            onClick={toggleAutoMode}
            title="自动购买当前目标并部署机器"
          >
            自动 {autoMode() ? "开" : "关"}
          </button>
        </div>
        <Show when={notice()}>
          <div class="notice" role="status" aria-live="polite">{notice()}</div>
        </Show>
        <nav class="tabs" aria-label="主导航">
          <For each={TABS}>
            {(tabItem) => (
              <Show when={tabItem.id !== "board" || lbStatus() !== "hidden"}>
                <button
                  class="tab"
                  classList={{ active: tab() === tabItem.id }}
                  aria-current={tab() === tabItem.id ? "page" : undefined}
                  onClick={() => setTab(tabItem.id)}
                >
                  {tabItem.label}
                </button>
              </Show>
            )}
          </For>
        </nav>
      </header>

      <main class="content" inert={dialogOpen()}>
        <Show when={tab() === "ops"}>
          <Show when={climbing()} fallback={<EraOpsPanel />}>
            <ClimbPanel />
          </Show>
          <PulsePanel />
        </Show>
        <Show when={tab() === "shop"}>
          <ShopPanel />
        </Show>
        <Show when={tab() === "ladder"}>
          <RoutePanel />
        </Show>
        <Show when={tab() === "board"}>
          <BoardPanel />
        </Show>
        <Show when={tab() === "codex"}>
          <CodexPanel />
        </Show>
      </main>
    </div>
  );
}

function ClimbPanel() {
  const current = () => rung();
  const percent = () => Math.round(rungFill() * 100);
  const argument = () => rungArgument(current().n, state().rungProgress).toLocaleString();
  const argumentMax = () => rungArgumentMax(current().n).toLocaleString();
  return (
    <section class="page panel game-page">
      <div class="section-head">
        <div>
          <span class="eyebrow">主线 · {current().n}/{CLIMB_LENGTH}</span>
          <h1>{current().name}</h1>
        </div>
        <span class="phase-tag">{current().phase === "finite" ? "有限" : "序数"}</span>
      </div>

      <div class="climb-value">{compactClimbValue(state())}</div>
      <Show when={current().n === FINAL_RUNG}>
        <details class="notation-details">
          <summary>F(α) = φ_α(0) · 展开记号</summary>
          <div>{climbText()}</div>
        </details>
      </Show>
      <div class="progress-line">
        <span>{argument()} / {argumentMax()} {current().unit}</span>
        <strong>{percent()}%</strong>
      </div>
      <div
        class="bar large"
        aria-label="当前阶段进度"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent()}
      >
        <div class="bar-fill" style={{ width: `${rungFill() * 100}%` }} />
      </div>
      <div class="run-line">
        <span>+{climbSpeed().toFixed(2)} {current().unit}/s</span>
        <Show when={Number.isFinite(climbEta())}>
          <span>完成约 {formatSeconds(climbEta())}</span>
        </Show>
      </div>

      <div class="action-grid">
        <button class="primary-action" disabled={!machineAffordable()} onClick={buyMachine}>
          <span>{machineRoom() > 0 ? "部署 1 台" : "部署已满"}</span>
          <strong>{machineRoom() > 0 ? formatMoney(machineCost()) : `${machines()}/${current().maxDrivers}`}</strong>
        </button>
        <button class="secondary-action" disabled={!machineAffordable()} onClick={buyMachineMax}>
          <span>全部部署</span>
          <small>{machines()}/{current().maxDrivers} · 空位 {machineRoom()}</small>
        </button>
      </div>
      <Show when={machineRoom() > 0 && !machineAffordable()}>
        <div class="afford-hint">约 {formatSeconds(affordIn(state(), machineCost()))} 可部署</div>
      </Show>

      <div class="goal-card">
        <span class="eyebrow">下一节点</span>
        <strong>{current().nextNotation}</strong>
        <span>满格后切换</span>
      </div>
      <Show when={current().n === FINAL_RUNG}>
        <div class="milestone">Γ₀ → ψ 路线</div>
      </Show>
    </section>
  );
}

function EraOpsPanel() {
  const targetIndex = () => eraFrontier(state());
  const target = () => era().gens[targetIndex()]!;
  const targetStatus = () => eraRungStatus(targetIndex());
  const owned = () => state().eraGens.reduce((sum, count) => sum + count, 0);
  const targetLabel = () => targetIndex() >= 0 ? formatOrd([target().increment(state().alpha, 1)]) : "等待下一纪元";
  const localFill = () => Math.max(0, Math.min(1, progress() * era().gens.length - targetIndex()));
  return (
    <section class="page panel game-page">
      <div class="section-head">
        <div>
          <span class="eyebrow">纪元 · {era().short}</span>
          <h1>{era().name}</h1>
        </div>
        <span class="phase-tag">周目 {state().transcends}</span>
      </div>

      <div class="era-alpha">{formatOrd(state().alpha)}</div>
      <div class="progress-line">
        <span>路线进度</span>
        <strong>{(progress() * 100).toFixed(1)}%</strong>
      </div>
      <div class="bar large" role="progressbar" aria-label="纪元路线进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number((progress() * 100).toFixed(1))}>
        <div class="bar-fill" style={{ width: `${progress() * 100}%` }} />
      </div>

      <Show when={targetIndex() >= 0} fallback={<div class="goal-card">等待下一纪元</div>}>
        <div class="goal-card era-target">
          <div>
            <span class="eyebrow">节点 {targetIndex() + 1}/{era().gens.length}</span>
            <strong>{targetLabel()}</strong>
            <span>{target().wall ? "纪元终点" : "当前目标"}</span>
          </div>
          <div class="target-owned">×{targetStatus().owned}</div>
          <button
            class="primary-action"
            disabled={!targetStatus().affordable}
            onClick={() => buyEra(targetIndex())}
          >
            <span>购买</span>
            <strong>{formatMoney(targetStatus().cost)}</strong>
          </button>
          <button
            class="mini"
            disabled={!targetStatus().affordable}
            onClick={() => buyEraMax(targetIndex())}
          >
            全买
          </button>
        </div>
      </Show>

      <div class="run-line node-progress">
        <span>本节点 {(localFill() * 100).toFixed(0)}% · 门槛 {stageThreshold(state()).toLocaleString()}</span>
        <span>{Number.isFinite(checkpointEta(state())) ? `约 ${formatSeconds(checkpointEta(state()))}` : "购买后开始推进"}</span>
      </div>
      <Show when={targetIndex() >= 0 && !targetStatus().affordable}>
        <div class="afford-hint">约 {formatSeconds(affordIn(state(), targetStatus().cost))} 可购买</div>
      </Show>
      <div class="subline">已部署 {owned()} 台 · 目标：{era().wallName}</div>
      <Show when={!state().policy}>
        <button class="mini" onClick={openPolicyPrompt}>选择运行策略</button>
      </Show>

      <details class="node-details">
        <summary>查看全部节点</summary>
        <div class="node-list">
          <For each={era().gens}>
            {(generator, index) => {
              const status = () => eraRungStatus(index());
              return (
                <Show
                  when={!status().locked}
                  fallback={<div class="node-row locked"><span>···</span><span>未解锁</span></div>}
                >
                  <div class="node-row">
                    <span>{generator.name}</span>
                    <span>×{status().owned}</span>
                    <button class="mini" disabled={index() < targetIndex() || !status().affordable} onClick={() => buyEra(index())}>
                      {index() < targetIndex() ? "已完成" : "买"}
                    </button>
                    <span class="cost">{formatMoney(status().cost)}</span>
                  </div>
                </Show>
              );
            }}
          </For>
        </div>
      </details>
    </section>
  );
}

function PulsePanel() {
  const charges = () => pulseCharges(state());
  const supply = () => moneyRate(state()).mul(PULSE_MONEY_SECONDS);
  return (
    <section class="panel pulse-panel" aria-label="脉冲操作">
      <div class="pulse-meter">
        <strong>脉冲 {charges()}/{PULSE_MAX_CHARGES}</strong>
        <span>{charges() === PULSE_MAX_CHARGES ? "已充满" : `${pulseReadyIn(state())}s 充能`}</span>
        <div class="pulse-track" aria-hidden="true">
          <div style={{ width: `${charges() === PULSE_MAX_CHARGES ? 100 : (state().pulseTicks % PULSE_COST_TICKS) / PULSE_COST_TICKS * 100}%` }} />
        </div>
      </div>
      <div class="pulse-actions">
        <button disabled={!canUsePulse(state(), "progress")} onClick={() => pulseAction("progress")} title="消耗 1 格，推进已部署机器；遇到节点即停止">
          <strong>推进 +{PULSE_PROGRESS_SECONDS}s</strong><small>消耗 1 格</small>
        </button>
        <button disabled={!canUsePulse(state(), "money")} onClick={() => pulseAction("money")} title={`消耗 1 格，领取当前产出 ${PULSE_MONEY_SECONDS} 秒的算力`}>
          <strong>补给 +{formatMoney(supply())}</strong><small>消耗 1 格</small>
        </button>
      </div>
    </section>
  );
}

function ShopPanel() {
  const recommended = createMemo(() => bestMoneyGen(state()));
  return (
    <section class="page panel shop-page">
      <div class="section-head">
        <div>
          <span class="eyebrow">经济</span>
          <h1>商店</h1>
        </div>
        <strong class="total-rate">+{formatMoney(moneyRate(state()))}/s</strong>
      </div>

      <Show when={recommended() >= 0}>
        <button class="recommended-buy" onClick={buyRecommended}>
          <span>优先升级 · {MONEY_GENS[recommended()]!.name}</span>
          <span>收益/价格最高 →</span>
        </button>
      </Show>

      <div class="income-strip">
        <span>基础 {incomeParts().base.toFixed(1)}</span>
        <span>检查点 ×{formatMoney(incomeParts().checkpoint)}</span>
        <span>周目 ×{incomeParts().cycle}</span>
        <span>策略 ×{incomeParts().policy}</span>
      </div>

      <div class="purchase-list">
        <For each={MONEY_GENS}>
          {(generator, index) => {
            const count = () => state().gens[index()] ?? 0;
            const cost = () => moneyGenCost(index(), count());
            const preview = () => previewMoneyGen(state(), index());
            const next = () => state().gens[index() + 1] ?? 0;
            return (
              <div class="purchase-row" title={`${generator.what} ${generator.why}`}>
                <button class="purchase-main" onClick={() => buyGen(index())} disabled={state().money.lt(cost())}>
                  <span class="purchase-name">{generator.name} <small>×{count()}</small></span>
                  <span class="purchase-gain">+{formatMoney(preview().increase)}/s</span>
                  <span class="cost">{formatMoney(cost())}</span>
                </button>
                <button class="mini" onClick={() => buyGenMax(index())} disabled={state().money.lt(cost())}>全买</button>
                <Show when={next() > 0}>
                  <span class="purchase-boost">上层 ×{(1 + 0.25 * next()).toFixed(2)}</span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <div class="subsection">
        <div class="subsection-head">
          <span>手动算力</span>
          <span class="dim">Lv.{state().clickLevel} · +{clickValue(state())}/次</span>
        </div>
        <button
          class="purchase-main upgrade-row"
          onClick={() => buyClick()}
          disabled={state().money.lt(clickUpgradeCost(state().clickLevel))}
        >
          <span>升级手算</span>
          <span class="cost">{formatMoney(clickUpgradeCost(state().clickLevel))}</span>
        </button>
      </div>

      <details class="utility-block">
        <summary>存档</summary>
        <div class="save-row">
          <button class="mini" onClick={() => openSaveDialog("export")}>导出</button>
          <button class="mini" onClick={() => openSaveDialog("import")}>导入</button>
        </div>
      </details>
    </section>
  );
}

function RoutePanel() {
  return (
    <section class="page panel route-page">
      <div class="section-head">
        <div>
          <span class="eyebrow">路线</span>
          <h1>{climbing() ? "运算阶梯" : "纪元链"}</h1>
        </div>
        <span class="phase-tag">{climbing() ? `${(omegaMeter() * 100).toFixed(0)}%` : `${(progress() * 100).toFixed(1)}%`}</span>
      </div>
      <Show when={climbing()} fallback={<EraRoadmap />}>
        <LadderStrip />
        <div class="route-foot">前 {FINITE_LAST} 级为有限记号；之后进入序数检查点。数学说明见图鉴。</div>
      </Show>
    </section>
  );
}

function LadderStrip() {
  return (
    <div class="ladder">
      <For each={CLIMB_RUNGS}>
        {(rungDef) => {
          const done = () => state().phase === "era" || rungDef.n < state().rung;
          const current = () => state().phase === "climb" && rungDef.n === state().rung;
          return (
            <div class="ladder-rung" classList={{ done: done(), current: current() }}>
              <span class="ladder-n">{String(rungDef.n).padStart(2, "0")}</span>
              <span class="ladder-glyph">{rungDef.glyph}</span>
              <span class="ladder-name">{rungDef.name}<span class="dim"> → {rungDef.nextNotation}</span></span>
              <span class="ladder-mark">{done() ? "✓" : current() ? "▸" : "·"}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function EraRoadmap() {
  const index = () => state().era;
  return (
    <div class="roadmap compact-roadmap">
      <div class="roadmap-item" classList={{ current: state().phase === "climb" }}>
        <span>{state().phase === "climb" ? "▸" : "✓"}</span> 运算阶梯 <small>Γ₀</small>
      </div>
      <For each={STATIC_ERAS.slice(1)}>
        {(definition, offset) => {
          const eraIndex = offset() + 1;
          return (
            <div class="roadmap-item" classList={{ done: eraIndex < index(), current: eraIndex === index() }}>
              <span>{eraIndex < index() ? "✓" : eraIndex === index() ? "▸" : "·"}</span>
              {definition.short} <small>{definition.wallName}</small>
            </div>
          );
        }}
      </For>
      <div class="roadmap-item" classList={{ current: index() >= STATIC_ERAS.length }}>
        <span>{index() >= STATIC_ERAS.length ? "▸" : "·"}</span> 大基数主题路线 <small>∞</small>
      </div>
    </div>
  );
}

function CodexPanel() {
  const [selected, setSelected] = createSignal<string | null>("omega");
  const entry = () => CODEX.find((item) => item.id === selected()) ?? null;
  return (
    <section class="codexpanel panel page">
      <div class="section-head">
        <div>
          <span class="eyebrow">参考</span>
          <h1>图鉴</h1>
        </div>
        <span class="dim">数学说明放在这里</span>
      </div>
      <div class="codex-list">
        <For each={CODEX}>
          {(item) => (
            <button
              class="mini codex-term"
              classList={{ active: selected() === item.id }}
              onClick={() => setSelected(item.id)}
            >
              {item.title}
            </button>
          )}
        </For>
      </div>
      <Show when={entry()}>
        {(item) => <div class="codex-text">{item().text}</div>}
      </Show>
    </section>
  );
}
