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
    text: "第一个满足 ω^ε₀ = ε₀ 的序数(ω 的第一个不动点)。CNF 只能表示 ε₀ 之下的序数——逼近它时,显示会开始崩溃。这不是 bug,是表示法的极限,也是转生的召唤。",
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
    text: "公理是你为宇宙选择的规则。同一个问题在公理之外可以有多种自洽答案——连续统假设独立于 ZFC。选择公理卡,就是选择你所在的宇宙。",
  },
  {
    id: "vl",
    title: "V=L (可构造宇宙)",
    aliases: ["vl", "v=l", "constructible"],
    text: "「宇宙是可构造的」:每个集合都有定义。朴素、稳定、高产(产出 ×5、点击 ×5)——代价是序列收敛更慢(阈值 ×2):慢,才能看清每一级。公理在每堵墙后都可以重新选择。",
  },
  {
    id: "forcing",
    title: "Forcing (力迫法)",
    aliases: ["forcing", "力迫"],
    text: "Cohen 的力迫法:在给定宇宙中「构造」新宇宙,让独立命题按你的意愿成立。产出 ×2、点击 ×2,序列收敛更快(阈值 ×0.5)——快,就要接受更粗的粒度。",
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
    text: "Γ₀ 是 a ↦ φ(a,0) 的第一个不动点,也是二元 Veblen 表示能触及的极限。越过它,φ 需要第三个参数——或者一种全新的思路:不再往上堆不动点,而是把整个层谱「坍缩」回可数。",
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
    text: "SVO = ψ(Ω^(Ω^ω)),多元 Veblen 层次的极限。在它之前你攀过 φ(1,·)、φ(2,·)…… 的整个二元网格;在它之后,连「有限的函数元数」都不够用了。",
  },
  {
    id: "lvo",
    title: "LVO (大 Veblen 序数)",
    aliases: ["lvo", "large-veblen", "大veblen序数"],
    text: "LVO = ψ(Ω^(Ω^Ω)),序数记法的著名地标:它是用 Ω 的幂塔参数能写出的最后一批可数序数之一。再往上,每一行都得先问一句——这个序数,还是可数的吗?",
  },
  {
    id: "bho",
    title: "BHO (巴赫曼-霍华德序数)",
    aliases: ["bho", "bachmann-howard", "巴赫曼霍华德"],
    text: "BHO = ψ(ε_{Ω+1}),凭借「给 Ω 配一个不稳定函数 σ」所得的可数序数极限,也是证明论强度的经典标尺(ID₀<BHO)。越过 BHO,可数序数的记述告一段落——下一个里程碑,是不可数本身。",
  },
  {
    id: "aleph",
    title: "阿列夫层谱 ℵ",
    aliases: ["aleph", "ℵ", "omega1", "ω1", "阿列夫"],
    text: "ℵ₀ = ω 是可数无穷;ℵ₁ 是第一个不可数序数——比任何可数序列的极限都更大,无法由「再爬一级」到达,只能换公理。ℵ₂、ℵ_ω、ℵ_{ε₀}…… 指标可以又是序数;而ℵ_δ 对任何可数 δ 都是奇异基数,够不到第一颗正则强极限。",
  },
  {
    id: "inaccessible",
    title: "不可达基数与大基数阶梯",
    aliases: ["inaccessible", "不可达", "mahlo", "maho", "weakly-compact", "huge", "大基数"],
    text: "不可达基数是正则强极限基数:加法乘法达不到,取幂也达不到——它是「层谱的层谱」。再往上是 Mahlo、弱紧、不可言、几乎巨大、巨大、超大……每一级都以上一级为起点。公理没有尽头:这条阶梯就是游戏的后半程,永远爬不完。",
  },
  {
    id: "absolute",
    title: "Ω (绝对无穷)",
    aliases: ["absolute", "absolute-infinity", "绝对无穷", "Ω", "omega-bar"],
    text: "康托尔的绝对无穷:一切序数的真类。它不是集合,没有后继,不可到达——所有序数组成的类甚至不是一个序数(Burali-Forti)。仪表盘上它的读数永远是「未定义」。这场攀爬没有终点,这正是它的意义。",
  },
];

export function findCodex(term: string): CodexEntry | null {
  const t = term.trim().toLowerCase();
  if (t === "") return null;
  return CODEX.find((c) => c.id === t || c.aliases.some((al) => al.toLowerCase() === t)) ?? null;
}
