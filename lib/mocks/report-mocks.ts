import type {
  NegotiationTips,
  Overview,
  PositionInfo,
  ResumeDiagnosis,
  SalaryInsight,
  WorkplaceInsight,
} from "@/lib/types";
import { cityCoefficients } from "@/lib/salary-anchors";

export const overviewMock: Overview = {
  positioning:
    "B 端 PM 方向的结构化共情型候选人——擅长把业务诉求翻译成 PRD，但缺商业量化和数据分析历练，离亮眼候选人还有一段距离。",
  summary:
    "具备结构化思考和共情能力，适合 B 端产品方向。商业数据敏感度不足是校招阶段主要短板。",
  strength: {
    title: "结构化共情",
    detail: "能把用户反馈拆成可执行问题点并落地为 TODO，B 端面试官尤其看重。",
  },
  improvement: {
    title: "商业量化感",
    detail: "对收入/利润率/ROI 类指标阅读量不足，每周 1 份财报或业务周报可补齐。",
  },
  personality: {
    type: "ENFJ · 温和型推动者",
    traits: ["共情力强", "结构化", "协作导向", "偶尔犹豫"],
    description:
      "能在小组里自然被推到「协调位置」，善于倾听并把讨论落成 TODO。这种特质在校招初期非常受带教团队欢迎，但在陌生领域容易过度准备而延迟启动；入职后前 3 个月需要主动练习「要结果、拍板、对抗分歧」的强硬面。",
  },
};

// 应届校招偏中位更贴近现实：数字非圆整（假装来自薪酬数据库）
export const salaryMock: SalaryInsight = {
  quartiles: { low: 6280, median: 8420, high: 13640, unit: "元/月" },
  industryComparison: [
    { industry: "互联网/IT", avgSalary: 9420 },
    { industry: "金融/银行", avgSalary: 8960 },
    { industry: "咨询", avgSalary: 8380 },
    { industry: "消费品", avgSalary: 7240 },
    { industry: "制造业", avgSalary: 6180 },
  ],
  userIndustry: {
    industry: "互联网/IT",
    avgSalary: 9420,
    note: "意向所在行业，本岗位薪资水平位居前列",
  },
  cityCoefficient: cityCoefficients.map((c) => ({
    tier: c.tier,
    coefficient: c.coefficient,
    sampleCity: c.sampleCity,
    isUserTier: c.tier === "一线城市",
  })),
};

export const positionInfoMock: PositionInfo = {
  subPositions: [
    {
      name: "B 端产品经理",
      priority: "primary",
      coreResponsibilities: [
        "与业务方沟通，梳理工作流并输出 PRD",
        "跟进开发实现，保障上线节奏",
        "通过埋点/调研评估方案效果并迭代",
      ],
      coreCompetencies: [
        { name: "业务理解", score: 78, description: "理解客户真实业务流程，识别关键痛点" },
        { name: "文档能力", score: 82, description: "写出让开发/业务一眼看懂的 PRD" },
        { name: "逻辑结构", score: 80, description: "把复杂需求拆成清晰的模块" },
        { name: "项目推进", score: 70, description: "跨团队协调与节奏控制" },
        { name: "AI 应用", score: 60, description: "用 AI 工具提升调研和写作效率" },
      ],
      fitReason:
        "测评显示你 J 倾向明显、共情力高，简历中在社团活动 / 课程项目里反复出现「协调」「梳理」动作。B 端 PM 恰恰需要把业务方的模糊描述整理成 PRD，再推动开发落地——这是你的天然舒适区，相比 C 端的快节奏创新更容易让你在前 6 个月交出成绩。",
    },
    {
      name: "C 端产品经理",
      priority: "secondary",
      coreResponsibilities: [
        "做用户研究，找出关键需求",
        "输出交互方案，推动快速迭代",
        "配合运营做增长活动",
      ],
      coreCompetencies: [
        { name: "用户洞察", score: 74, description: "从行为数据中识别用户真实意图" },
        { name: "数据敏感", score: 65, description: "会用 SQL/BI 自查关键指标" },
        { name: "创意产出", score: 70, description: "能提出差异化的产品方案" },
        { name: "快节奏", score: 68, description: "适应高频迭代" },
        { name: "AI 应用", score: 58, description: "用 AI 做用户访谈摘要等" },
      ],
      fitReason:
        "你对用户需求的敏感度（测评 F 倾向明显）能直接迁移到 C 端的用户研究环节。但 C 端节奏更快，需要在数据敏感度上补课——你简历里暂未见明显 SQL / 指标分析经历，如果走这条路，入职前建议刷一遍 SQL 基础 + 某本互联网数据分析入门书。",
    },
  ],
};

export const resumeDiagnosisMock: ResumeDiagnosis = {
  overallScore: 72,
  recommendations: [
    {
      title: "实习成果缺少量化",
      issue: "实习经历仅描述做了什么，没有说清楚数字结果或带来的业务影响。",
      suggestion:
        "对每段实习补 1-2 条量化成果，例如「参与 N 个功能落地，日活从 X 提升到 Y」；如无数字，用范围/百分比/对比也行。",
      priority: "high",
      quotedSnippet: "负责某模块的需求调研和 PRD 撰写",
    },
    {
      title: "技能栈罗列无主次",
      issue: "技能区列了 10+ 个工具，看不出哪些是真正熟练的。",
      suggestion:
        "将技能分级为「熟练 / 使用过 / 了解」三档，或在最前面标注 3 个核心专长。意向岗位相关的技能放首位。",
      priority: "medium",
      quotedSnippet: "技能：Python / SQL / Figma / Sketch / ...",
    },
    {
      title: "校园项目偏流程化描述",
      issue: "只写「和团队完成 X 项目」，看不出你的个人贡献。",
      suggestion:
        "按 STAR 结构改写：Situation/Task（背景）→ Action（我具体做了什么）→ Result（成果）。突出「我」。",
      priority: "medium",
    },
  ],
};

export const negotiationMock: NegotiationTips = {
  aiExperience: {
    summary:
      "越来越多校招 JD 把「AI 应用经验」列为加分项——面试官真正关心的是你能不能讲清楚哪几个场景把 AI 用明白了。有真实成果的候选人在 offer 谈判里一般能撬动 10-20% 的薪资空间。",
    points: [
      "在作品集 / GitHub 里放 1 个由你主导、AI 明显提效的案例：说清楚原工作流多长、你怎么拆解、用了什么工具（Claude / Cursor / LangChain 等）、结果从 X 变到 Y，用数字支撑。",
      "熟练掌握 2-3 个主流 AI 工具链并能讲出各自的「拿手戏」——例如「Claude 适合长文档结构化摘要、Cursor 适合代码重构、自建 workflow 适合批量处理」，回答时避免只列工具名。",
      "理解模型能力边界——面试时能直接说「这个任务我会让 AI 做前 60%，后 40% 必须人工兜底，因为 XXX」，展示对幻觉和可靠性的判断。",
    ],
  },
  internshipExperience: {
    summary:
      "HR 最看重的不是实习公司牌子，而是你有没有能被数字验证的成果。一份真实、可复述、可展示的案例，是谈薪环节最硬的锚点。",
    points: [
      "把 1-2 段实习打磨成完整 STAR 故事：你负责的模块、做了哪些具体动作、上线后的量化结果（如「活跃从 X 提升到 Y」「覆盖 N 个客户」「节省 Z 小时/周」），并准备在面试里 2 分钟讲完。",
      "把成果沉淀到可打开的位置——GitHub / 飞书文档 / 腾讯文档 / 公众号 / 作品集网站任选 1-2 个，面试官想深入时能扫码直接看，不需要你另发。",
      "谈薪时主动把「成果清单」放在岗位期望薪资的旁边——例如「我希望对标贵司 P5 中位，基于我在 X 实习做的 Y 项目 + Z 数据」，让 HR 和业务方看到你的锚点。",
    ],
  },
};

export const workplaceInsightMock: WorkplaceInsight = {
  industryAdvice: {
    summary:
      "互联网与科技行业整体告别纯增长时代，进入效率与差异化驱动阶段；AI 原生产品与 toB 服务是接下来 3 年最稳的两条校招通路。",
    items: [
      "AI 应用层岗位近两年持续扩张——产品 / 运营 / 设计都出现了「AI 版」招聘描述，JD 里「Prompt 工程」「LLM 应用」关键词出现频率比 2024 年翻倍。",
      "toB / SaaS 业务相对稳定，适合喜欢深入业务的同学；但早期项目体验不如 C 端亮眼，初期出活儿周期长，需要做好心理预期。",
      "出海与跨境业务是结构性新增路径（TikTok / SHEIN / 米哈游海外等），对英语口语、跨时区协作和文化理解有门槛，海归或语言类专业加分明显。",
      "一线核心岗位仍集中在北上深杭四城，其他城市以分公司支持岗为主；若在意核心业务体感，建议优先投一线城市的总部岗。",
    ],
  },
  companyInsight: {
    targetLabel: "互联网大厂",
    developmentSummary:
      "据 2024-2025 年公开财报与媒体报道，这类公司整体进入「效率 + AI 原生」双主线阶段：C 端业务逐步向精品化收敛，新增 headcount 集中在 AI 应用层、出海业务与 toB 商业化；部分团队在 Q3-Q4 经历过组织合并，对应届生的用人偏好由「通用型多面手」向「有明确方向且能快速上手 AI 工具」倾斜，面试对「实际落地过一个小闭环」的要求明显提高。",
    summary:
      "综合公开招聘信息、脉脉、小红书、知乎、校招贴吧上的一手反馈，可以提炼出这类公司对应届生而言的几个典型观察。",
    observations: [
      {
        source: "脉脉常见吐槽",
        voice:
          "「同岗不同级差距大」被反复提到——同一个岗位名可能 P4/P5/P6 都有人做，薪资差 20-30%，入职前一定要问清楚 Level。",
      },
      {
        source: "小红书校招笔记",
        voice:
          "学长学姐普遍反映「直属 leader 决定幸福感」的比重超过公司名。终面尽量能见到或打听到具体带你的那位。",
      },
      {
        source: "知乎校招话题",
        voice:
          "「轮岗」制度是双刃剑，既是机会也是漂流。如果岗位 JD 带「轮岗」字样，签约前问清楚起始组和最长停留时长。",
      },
    ],
    attentions: [
      "签约前追问 HR 三件事：具体 Level（P/T/M 数字）、直属 leader 姓名与背景、是否进轮岗池。",
      "看全 base 以外的 package 结构：签字费 / 股票归属比例 / 年终倍数区间，对比同校拿到的同级 offer。",
      "多方验证：脉脉搜「目标公司 + 校招」+ 小红书搜「公司名 + 学长学姐」+ 知乎校招话题，交叉看近 6 个月帖子。",
    ],
  },
  synthesis:
    "总体而言，这类公司对应届生算是相对友好的进入口，但「公司名」远没有「你直接汇报的那位 leader + 你入职后第一年做的那一摊事」重要。拿到 offer 之后别急着签，留 3-5 天做上面三条确认，再决定。",
};
