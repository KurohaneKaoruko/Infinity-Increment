/* Leaderboard panel — server deployments only.
 * probeServer() gates the whole thing: on static hosts lbStatus stays "hidden"
 * and nothing here ever renders. */
import { For, Show } from "solid-js";
import { eraLabel, formatRank } from "./leaderboard";
import { lbBoard, lbBusy, lbName, lbStatus, refreshBoard, renamePlayer, submitToLeaderboard } from "./gamestore";

export default function LeaderboardPanel() {
  const st = () => lbStatus();
  return (
    <Show when={st() !== "hidden"}>
      <div class="lbpanel panel">
        <div class="panel-title">▍排行榜(服务器)</div>
        <Show when={st() === "loading"}>
          <div class="dim">连接服务器…</div>
        </Show>
        <Show when={st() === "error"}>
          <div class="dim">服务器不可达。</div>
        </Show>
        <Show when={st() === "ready" || st() === "error"}>
          <div class="lb-submit">
            <input
              class="lb-name"
              value={lbName()}
              maxlength={24}
              placeholder="称号(最长 24 字)"
              onInput={(e) => renamePlayer(e.currentTarget.value)}
            />
            <button
              class="mini"
              disabled={lbBusy()}
              onClick={() => void submitToLeaderboard()}
              title="上传当前进度(序数位置 + 转生数)"
            >
              {lbBusy() ? "上传中…" : "[ 上传进度 ]"}
            </button>
          </div>
          <div class="lb-list">
            <For each={lbBoard().entries}>
              {(e, i) => (
                <div class="lb-row" classList={{ self: e.self === true }}>
                  <span class="lb-pos dim">#{i() + 1}</span>
                  <span class="lb-name">{e.name}</span>
                  <span class="lb-rank">{formatRank(e.rank)}</span>
                  <span class="lb-meta dim">
                    {eraLabel(e.era)} · 转生 ×{e.transcends} · α={e.alpha}
                  </span>
                </div>
              )}
            </For>
          </div>
          <div class="lb-foot dim">
            共 {lbBoard().total} 条记录 ·
            <button class="mini" onClick={() => void refreshBoard()}>刷新</button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
