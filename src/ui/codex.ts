/* Codex: the man-page database (data-only; adding entries never touches code). */
export interface CodexEntry {
  id: string;
  title: string;
  aliases: string[];
  text: string;
}

export const CODEX: CodexEntry[] = [
  {
    id: "ordinal",
    title: "序数 (Ordinal)",
    aliases: ["序数", "ordinal", "ord"],
    text: "序数是「第几」的数学化:0,1,2,… 之后是第一个无穷序数 ω。序数度量位置与顺序——本游戏里,你的进度就是一个序数 α,只增不减。",
  },
  {
    id: "omega",
    title: "ω (Omega)",
    aliases: ["omega", "ω", "w"],
    text: "第一个无穷序数:所有自然数的顺序类型。1+ω=ω——有限的一步加在 ω 面前会被吸收;而 ω+1>ω。它是你遇到的第一堵墙,也是第一扇门。",
  },
  {
    id: "cnf",
    title: "Cantor 范式 (CNF)",
    aliases: ["cnf", "范式", "cantor"],
    text: "任何 ε₀ 之下的序数都能唯一写成 ω^e₁·c₁ + ω^e₂·c₂ + …(指数递降)。引擎用 CNF 精确表示你的位置——显示的就是它的真身。",
  },
  {
    id: "epsilon0",
    title: "ε₀ (Epsilon-Zero)",
    aliases: ["epsilon0", "epsilon-0", "epsilon_0", "ε0", "ε₀", "ep0"],
    text: "ε₀ 是满足 ω^α=α 的最小序数，也是有限高度 ω 指数塔的上确界。每个有限高度仍严格小于 ε₀；游戏在有限门槛处跳到该上确界，是节奏抽象，不是有限塔达到 ε₀。CNF 可表示所有小于 ε₀ 的序数。",
  },
  {
    id: "hyperoperation",
    title: "超运算 (Hyperoperation)",
    aliases: ["hyperoperation", "超运算", "uparrow", "箭头"],
    text: "超运算以递归方式推广重复运算：加法、乘法、乘方、迭代幂次等。Knuth 箭头可对任意有限箭头数 k 定义；不存在一个数学上的最大箭头数。游戏只展示有限样例，并在路线门槛处切换到序数主题。",
  },
  {
    id: "knuth",
    title: "高德纳上箭头 (Knuth's up-arrow)",
    aliases: ["knuth", "up-arrow", "uparrow-notation", "高德纳", "上箭头"],
    text: "a↑b=a^b，a↑↑b 表示迭代幂次，增加有限个箭头可递归定义更高阶超运算。k 仍是自然数时，a↑^k b 仍是有限数（对常见整数底数与参数）。“记号用尽并到达 ω”不是定理；游戏只把一列无界有限值的上确界 ω 作为路线检查点。",
  },
  {
    id: "tetration",
    title: "迭代幂次 (Tetration, ↑↑)",
    aliases: ["tetration", "迭代幂次", "power-tower", "tower"],
    text: "10↑↑n 是高度为 n 的 10 指数塔（依所采用的 tetration 约定）。对底数 ω，有限高度塔的上确界是 ε₀。‘写不下来’是实际资源限制，不是数学定义或序数极限。",
  },
  {
    id: "graham",
    title: "葛立恒数 (Graham's number)",
    aliases: ["graham", "葛立恒", "grahams-number", "g64"],
    text: "葛立恒数是组合数学证明中出现的一个巨大有限整数，常用递归的 Knuth 箭头定义。它不是最大有限数，也没有特殊的序数性质；其十进制展开远超任何物理存储设想，因而使用递归记号。",
  },
  {
    id: "mutation",
    title: "破级突变 (Notation mutation)",
    aliases: ["mutation", "破级", "突变", "level-up"],
    text: "游戏在阶段门槛处切换记号、让机器自动调谐，这是玩法规则。它不意味着旧记号无法表示新值，也不构成序数算术中的突变。实际数学上的极限检查点会在图鉴中给出。",
  },
  {
    id: "fixedpoint",
    title: "不动点 (Fixed point)",
    aliases: ["fixedpoint", "fixed-point", "不动点"],
    text: "α 是 f 的不动点，当且仅当 f(α)=α。ε₀ 是 ξ↦ω^ξ 的最小不动点。并非每个游戏阶段边界都对应不动点；其余边界可能只是为了节奏设定的检查点。",
  },
  {
    id: "fixpointladder",
    title: "Γ₀ 基本序列",
    aliases: ["fixpoint-ladder", "不动点层级", "phik0", "epsilon-numbers"],
    text: "Γ₀ 是 α↦φ_α(0) 的第一个不动点。一个标准基本序列从 ε₀ 开始反复应用 F(α)=φ_α(0)：ε₀、F(ε₀)、F²(ε₀)、……，其上确界为 Γ₀。注意 sup_{n<ω}φ_n(0)=φ_ω(0)，一般不等于 Γ₀。超限 Knuth 箭头的扩展需另行定义，不能由有限箭头直接推断。",
  },
  {
    id: "cofinality",
    title: "Cofinality (共尾性)",
    aliases: ["cofinality", "cofinal", "共尾", "cf"],
    text: "cf(ω)=ω:存在一列有限数无限逼近 ω——这列数就是 cofinal 序列。极限序数不可由有限步到达,只能被序列的极限「送达」。cofinal 生成器就是你放出的序列。",
  },
  {
    id: "axiom",
    title: "公理 (Axiom)",
    aliases: ["axiom", "公理"],
    text: "公理是数学理论的基本假设。不同理论可能对同一命题给出不同结果；例如连续统假设相对于 ZFC 是独立的。游戏的运行策略不是公理，也不改变数学对象的定义。",
  },
  {
    id: "vl",
    title: "V=L (可构造宇宙)",
    aliases: ["vl", "v=l", "constructible"],
    text: "V=L 表示集合论宇宙等于可构造宇宙 L。它是集合论语义中的命题，不等于游戏中的‘稳态计划’，也不推出任何货币倍率或序列门槛。",
  },
  {
    id: "forcing",
    title: "Forcing (力迫法)",
    aliases: ["forcing", "力迫"],
    text: "力迫法是在给定模型上构造扩张模型的技术，可用于证明许多命题相对于 ZFC 的独立性。它不推出游戏中的‘速推计划’倍率；二者只是同名主题与玩法参数的明确区分。",
  },
  {
    id: "veblen",
    title: "Veblen 层次 φ(a,b)",
    aliases: ["veblen", "phi", "φ", "二元veblen"],
    text: "把 ε 数列推广成两层:φ(1,0)=ε₀、φ(2,0)=ζ₀、φ(3,0)=η₀…… 第二参数沿序数爬升时,φ(a,b) 连续地取极限。第一参数本身也可以是序数:φ(ω,0)、φ(ω²,0),甚至 φ(ε₀,0) —— 序数开始作为序数的参数,记号由此自指。",
  },
  {
    id: "gamma0",
    title: "Γ₀ (Feferman–Schütte)",
    aliases: ["gamma0", "gamma-0", "Γ₀", "feferman"],
    text: "Γ₀（Feferman–Schütte 序数）是 α↦φ_α(0) 的第一个不动点。它也可由扩展 Veblen 函数 φ(1,0,0) 表示。二元 Veblen 记号是否能表达某个序数取决于具体记号系统；越过 Γ₀ 常改用扩展 Veblen 或坍缩函数。",
  },
  {
    id: "madore",
    title: "Madore ψ (坍缩函数)",
    aliases: ["madore", "psi", "ψ", "collapse", "坍缩"],
    text: "ψ 是「取第一个不在 C(α) 里的序数」:给定一组由 0,1,ω,Ω 经加减乘幂与 ψ(β<α) 封闭而成的集合,ψ(α) 挤出第一个漏网的序数。参数 α 越大,挤出的序数越大——用 Ω 自身的层谱作参数,就能记述远超 Γ₀ 的可数序数。",
  },
  {
    id: "svo",
    title: "SVO (小 Veblen 序数)",
    aliases: ["svo", "small-veblen", "小veblen序数"],
    text: "在常见的 Madore ψ 约定下，小 Veblen 序数可记为 ψ(Ω^(Ω^ω))。不同文献的坍缩函数约定可能不同；该记号是数学里程碑，不是由有限游戏参数自动推导出来的。",
  },
  {
    id: "lvo",
    title: "LVO (大 Veblen 序数)",
    aliases: ["lvo", "large-veblen", "大veblen序数"],
    text: "在相应的 Madore ψ 约定下，大 Veblen 序数常记作 ψ(Ω^(Ω^Ω))。名称依赖文献约定；它不是‘最后一批可数序数’，可数序数没有这样的最大值。",
  },
  {
    id: "bho",
    title: "BHO (巴赫曼-霍华德序数)",
    aliases: ["bho", "bachmann-howard", "巴赫曼霍华德"],
    text: "在标准 Bachmann–Howard 记号约定下，BHO 常写作 ψ(ε_{Ω+1})，是证明论中的重要序数标尺。它不是可数序数的最大值；可数序数不存在最大者。游戏所选 ψ 参数终点并不声称是 BHO。",
  },
  {
    id: "aleph",
    title: "阿列夫层谱 ℵ",
    aliases: ["aleph", "ℵ", "omega1", "ω1", "阿列夫"],
    text: "ℵ₀=ω，ℵ₁ 是第一个不可数初始序数。阿列夫函数按序数指标定义且在极限处连续；若 δ 是极限指标，ℵ_δ 的共尾性受 δ 控制，可能为奇异基数，但不能说所有可数 δ 都导致奇异。有限个指标样本不穷尽阿列夫层谱。",
  },
  {
    id: "inaccessible",
    title: "不可达基数与大基数阶梯",
    aliases: ["inaccessible", "不可达", "mahlo", "maho", "weakly-compact", "huge", "大基数"],
    text: "不可达基数（通常指强不可达）是正则强极限基数；其存在不能由 ZFC 证明（在相对一致性意义下需要更强假设）。Mahlo、弱紧、不可言、巨大等是不同大基数性质，部分有蕴含强弱关系，整体不是一个统一的总序。游戏把它们列成主题目录，仅为玩法顺序，不表示定理给出的大小排序或存在性证明。",
  },
  {
    id: "absolute",
    title: "Ω (绝对无穷)",
    aliases: ["absolute", "absolute-infinity", "绝对无穷", "Ω", "omega-bar"],
    text: "绝对无穷是历史哲学用语，不是序数。所有序数构成真类（Burali–Forti 悖论排除了‘序数全体是一个集合’）；因此不存在 Ω 这个序数，也没有到它的距离或进度百分比。",
  },
];

export function findCodex(term: string): CodexEntry | null {
  const t = term.trim().toLowerCase();
  if (t === "") return null;
  return CODEX.find((c) => c.id === t || c.aliases.some((al) => al.toLowerCase() === t)) ?? null;
}
