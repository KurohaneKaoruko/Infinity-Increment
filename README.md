# INFINITY // terminal

终端风格的增量游戏：沿有限记号、序数与坍缩函数等数学主题推进。Ω 是所有序数构成的真类，不是可达目标；游戏明确区分数学定义与人为平衡参数。

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm test         # vitest(含 fast-check 性质测试)
npm run build    # 产出单 HTML(dist/index.html),双击即玩
```

> **Windows 注意**:若在 Git Bash / MSYS 里跑 `npm test` 报
> `Cannot read properties of undefined (reading 'config')`,这是盘符大小写导致的
> Node 模块重复加载(shell 的 cwd 是小写 `d:\`,npm 的 bin shim 经 `cygpath -w`
> 转成大写 `D:\`)。在 PowerShell / CMD 里跑测试即可,或 `cd D:/<项目路径>` 后再跑。

## Web 部署

同一份构建支持两种形态,玩家数据始终默认留在浏览器(localStorage)。

**形态 A · 纯静态托管**(数据全在用户浏览器,无任何后端):

```bash
npm run build   # 产出 dist/(单 HTML + manifest + sw + icons)
# 把 dist/ 丢到任意静态托管:GitHub Pages / Netlify / Vercel / nginx / OSS
```

**形态 B · 服务器部署**(同上游览,额外提供排行榜):

```bash
npm start                     # = npm run build && npm run serve
# 或手动:PORT=8787 DATA_DIR=./server/data node server/index.mjs
```

服务器(`server/`,零 npm 依赖,`node:http` 裸写)一个进程做两件事:托管
`dist/` 静态文件 + 提供 `/api/leaderboard`。环境变量:`PORT`(默认 8787)、
`HOST`(默认 0.0.0.0)、`DIST_DIR`、`DATA_DIR`(排行榜 JSON 存储目录)。

排行榜设计:

- **无账号、荣誉制**:进度凭据 = 浏览器本地 device id + 自选称号,按 device
  只保留每个人的历史最佳(游戏路线分数大者胜,平局比周目数)
- **提交内容**:`{ 称号, 纪元, rank(游戏比较分数,十进制字符串), α 表示, 周目数 }`
  ——不含存档,不包含任何可重放进别人浏览器的数据
- **服务端兜底**:字段强校验(秩为纯数字串、era/transcends 范围、称号
  ≤24 字、α ≤48 字符)、按 IP 限流(60s 内 6 次、最小间隔 3s)、表上限 2000 行
- **静态托管下自动隐身**:页面加载时探测 `/api/leaderboard`,404/超时即隐藏
  整个排行榜面板,游戏行为与静态版完全一致
- ServiceWorker 已配置为**不缓存** `/api/` 请求
- 想改排行榜存储/排序/限制:改 `server/leaderboard-core.mjs`(纯逻辑,Node
  服务器与 Cloudflare Function 共用,由 `server/leaderboard-core.test.mjs`
  覆盖,`server/pages-function.test.ts` 锁定 CF 侧行为与核心语义一致)

**形态 A+ · Cloudflare**(静态托管 + 无需自建服务器的排行榜):

排行榜跑在 Cloudflare Workers + Workers KV 上,与 Node 服务器共用同一个核心
(`server/leaderboard-core.mjs`)。静态资源作为 Worker assets 挂载,API 与游戏
同域,无跨域问题。

**推荐 · Workers**(参数全在 `wrangler.jsonc`,dashboard 零操作):

```bash
npm run worker:deploy        # = vite build && wrangler deploy
```

KV namespace **不需要预先创建、也不需要写 id**:配置里只声明 binding,`wrangler deploy`
会走[自动供给](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)
自动创建 namespace。本地 CLI 部署会把真实 id 写回 `wrangler.jsonc`;而 Git 构建
(dashboard 部署)创建的 namespace,id 只存在于 dashboard、**不会写回仓库**——
所以仓库里可以完全没有 id。

`wrangler.jsonc` 字段:

| 字段 | 值 | 说明 |
|---|---|---|
| `name` | `infinity-increment` | Worker 名,部署后 `<name>.<你的子域>.workers.dev` |
| `main` | `worker/index.ts` | 入口:命中 `/api/leaderboard` 走共享 handler,其余回退 `index.html` |
| `compatibility_date` | 日期 | Workers 运行时兼容日期 |
| `kv_namespaces[0].binding` | `LEADERBOARD` | 代码里 `env.LEADERBOARD` 只认这个名字 |
| `kv_namespaces[0].id` | *省略* | 留空即自动供给;本地部署后 wrangler 会把真实 id 写回本文件 |
| `assets.directory` | `dist` | Vite 产物;静态文件由运行时先行匹配,未命中的才进 Worker |

> 注意:绑定的唯一来源是 `wrangler.jsonc`——官方明确建议"用 wrangler 就不要在
> dashboard 改 Worker 配置";dashboard 里手动加的绑定在下次部署时会被覆盖
> (新版 wrangler 会先警告并提示写回本地配置)。

请求流:静态文件由 assets 层直接响应;未命中文件的请求进 Worker——
`/api/leaderboard` 走排行榜 handler(响应头已带 `no-store`),其他路径回退
`index.html`(单文件游戏,不需要 `_redirects` 通配回退),兜底 HTML 也强制
`no-store`。注意 `_headers` 是 Pages 专属,Workers 的 assets 层不解析它;
Workers 上要给图标等静态资源加缓存头,用 dashboard 的 Cache Rules。

**备选 · Pages**(dashboard 点绑定,`functions/` 路由约定):

```bash
npm run pages:deploy     # Direct Upload:build + functions/ 复制进 dist/ + 部署
```

Git 连接模式不用复制,Cloudflare 直接从仓库根读 `functions/`。Pages 的 KV 绑定
只能 dashboard 配(项目 → Settings → Functions → KV namespace bindings,变量名
`LEADERBOARD`);未绑定时 `POST` 返回 503、`GET` 返回空榜,前端照常隐身,不会
白屏。注意 Pages 路线**不要**加 `_redirects` 的 SPA 通配回退,否则静态探测会
拿到 200 HTML 而误判服务器存在。

两条 Cloudflare 路径共用同一份 handler(`functions/api/leaderboard.ts`:
`handleGet`/`handlePost` 请求级实现,`onRequestGet`/`onRequestPost` 是 Pages
适配器),榜单以单个 KV key(`board`)读改写,接受最终一致性下并发丢一次提交的
风险(荣誉制 + 提交低频);body 上限 4KB(超限 413)、非法体 400,其余校验规则与
Node 服务器逐条一致。KV 免费额度 1k 写/天、10 万读/天,荣誉制场景足够,真超了
再换 D1。

## 打包:桌面端与移动端

游戏是单文件 Web 构建(dist/index.html),桌面与移动壳只是托管它的原生容器,
不需要任何平台 API——存档走 WebView 自带 localStorage(见 `src/ui/platform.ts`)。

**桌面端(Tauri v2)** —— 源码在 `src-tauri/`,已就绪但尚未构建:

```bash
npm run desktop:dev     # 装 @tauri-apps/cli 后启动(需 Rust 工具链)
npm run desktop:build   # 产出 Windows / macOS / Linux 安装包
```

**移动端(Capacitor)** —— `capacitor.config.ts` 指向 `dist`;原生图标/启动图
素材在 `resources/`,先合成为各平台资源:

```bash
npm run mobile:assets   # 由 resources/ 生成 android/ ios 图标与启动图
npx cap add android     # 或 ios
npm run mobile:sync     # 复制 dist + 同步插件
npm run mobile:open:android
```

**PWA** —— `public/manifest.webmanifest` + `public/sw.js`,在 http(s) 生产
构建下自动注册(file:// 双击玩与 Tauri/Capacitor 壳内不注册,两者本就离线可用)。

图标全部由 `scripts/gen-icons.py` 生成(纯标准库,无第三方依赖):

```bash
npm run icons           # 重新生成 src-tauri/icons、public/、resources/ 全套
npm run icons:check     # 只校验存在性
```

## 玩法:运算阶梯 → 纪元链

游戏不是「看着数字变大」，而是沿一条有明确边界说明的数学主题路线推进。有限记号阶段只存
`(级号, 进度)`，序数阶段存规范化的 Ord；不会把无法表示的十进制展开塞进浮点。

```
第 1–8 级   有限记号示例(基 10)
   运算    +      ×       ^       ↑↑       ↑↑↑      ↑↑↑↑     ↑↑↑↑↑     箭头层数
   读数    n      10·n    10^n    10↑↑n    10↑↑↑n   10↑↑↑↑n  10↑↑↑↑↑n  10↑^k 3
   ── 游戏检查点 ── sup(n<ω)=ω
第 9–13 级  序数基本序列路线
   记号    ω+n    ω·(2+n)  ω^(2+n)  ω↑↑h     Fⁿ(ε₀)
   上确界  ω·2    ω²        ω^ω       ε₀       Γ₀（仅 n→ω）
   ── 游戏检查点 ── 按有限门槛切换到下一精确检查点
纪元 II–IV  固定约定的 ψ 参数样本 → ℵ 参数样本 → 大基数主题路线
```

有限记号的递归关系按标准定义展示；序数路线则明确标出使用的运算和上确界。
这两段是教学路线，不宣称有限超运算会自动“变成”Veblen 函数。

- **每一级展示一种记号或基本序列**。机器在阶段切换时自动调谐到下一阶；这不是“旧记号不能表示新值”的数学定理。
- **序数检查点保持有序**:路线从 `ω`、`ω·2`、`ω²`、`ω^ω`、`ε₀` 开始，所有有限项都严格低于相应上确界。
- **仪表读数 = 记号里的那个 n**:进度条上的「6,250 / 9,987」正好对应读数 `10↑↑6,250`
  (`rungArgument` / `rungArgumentMax` 与 `renderRung` 共用同一个自变量)。
- **货币不参与运算**,它只是算力预算:决定你能同时部署几台机器。机器推进当前这一级的进度,
  进度填满 → 破级。
- **机器会自动调谐**:破级后保留当前部署并适配下一阶，下一阶增加的机器上限仍值得购买；新玩家默认开启自动调度。
- **脉冲是主动选择**:每 45 秒充 1 格（最多 3 格），花 1 格推进已部署机器最多 12 秒，或领取当前 15 秒产出；推进遇到节点即停止，不会替代数学定义。
- **自动采购按回报分配**:优先启动当前节点，再用盈余购买收益/价格最高的生成器（含相邻层加成），不会追购已完成节点。
- **离线持续运转**:收益按 50% 结算，最多 24 小时；路线和自动采购最多模拟 1 小时，其余时间仅计被动收入。充能随离线时间恢复；切回后台页面同样结算。
- **到 Γ₀ 是游戏路线的长期目标**；商店、自动调度和策略选择负责节奏，不改变数学定义。

**为什么 ω 侧不是继续写箭头?** 不是因为箭头有数学上的耗尽点，而是游戏选择切换主题。
有限高度的 ω 指数塔的上确界是 `ε₀`；Γ₀ 则是 `α↦φ_α(0)` 的第一个不动点。
游戏用 `ε₀, F(ε₀), F²(ε₀), …` 的基本序列（`F(α)=φ_α(0)`）表达这条路线；
有限门槛不会达到上确界本身。

平衡常量全部集中在 `src/core/game/ops.ts` 顶部与 `src/core/game/config.ts`;
节奏由 `src/core/game/sim.test.ts` 的贪心策略模拟守护。

## 序数引擎(src/core/ordinal)

有限序数子集使用真实的 Cantor 范式(CNF)算术。统一值类型还含有 Veblen、ψ、基数标记等
扩展项；其语义依赖各自注明的记号约定。特别是大基数标记的比较顺序是游戏路线约定，
不代表不同大基数性质构成数学上的总序，也不证明这些基数存在。

```ts
import { ZERO, ONE, OMEGA, add, mul, pow, compare, fromNumber } from "./core/ordinal/ordinal";
import { formatOrd } from "./core/ordinal/format";

const a = add(mul(mul(OMEGA, OMEGA), fromNumber(3)), fromNumber(5)); // ω^2·3 + 5
formatOrd(a);                                    // "ω^2·3 + 5"
compare(add(fromNumber(1), OMEGA), OMEGA);       // 0 —— 1 + ω = ω(左吸收)
compare(mul(fromNumber(2), OMEGA), OMEGA);       // 0 —— 2·ω = ω
compare(mul(OMEGA, fromNumber(2)), OMEGA);       // 1 —— ω·2 > ω

const r = pow(OMEGA, OMEGA);                     // ω^ω
if (r.ok) formatOrd(r.value);                    // "ω^ω"
// 结果超出引擎的实际嵌套预算(玩法上的 ε₀ 墙)时:
// r = { ok: false, reason: { kind: "out_of_range" } }
```

约定:

- **规范形由构造保证**:`add` / `mul` / `pow` / `canonicalize` 的输出永远是规范 CNF,同一序数只有一种表示
- **加法与乘法不可交换**:左吸收(`1+ω=ω`)是玩法核心,不是 bug
- **`pow` 返回 `OrdResult`**:在接近 ε₀(嵌套深度超过 `DEPTH_LIMIT`)时返回 `out_of_range` 信号,永不产生非法值
- **序列化无损**:`toJSON` / `fromJSON`(见 `serialize.ts`),存档直接可用
- **数学定律即测试预言**:`property.test.ts` 用 fast-check 验证结合律、吸收律、分配律、指数律、全序性与规范形唯一性

## 架构纪律

- `src/core` 零平台依赖(无 DOM / localStorage / window),为将来桌面壳(Steam)保持可移植
- 平台服务(存储等)一律走接口,见 `src/core/platform`
- 货币/基数侧的大数统一从 `src/core/bignum.ts` 引入(break_infinity.js 的唯一入口)
