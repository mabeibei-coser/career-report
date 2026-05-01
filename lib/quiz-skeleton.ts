/**
 * 快测题骨架：6 道题的 id / dimension / scoreMap 硬编码，LLM 只需生成题目文本和选项文本。
 * 输出 token 减半（~2400→1200），讯飞生成时间相应减半（~12s→6s）。
 *
 * 维度与下游消费：
 *   E-I / S-N / T-F / J-P → overview.personality.type (MBTI)
 *   risk                 → overview.personality / positionInfo.fitReason
 *   value                → overview.personality / 谈薪相关推断
 *
 * Q1（E-I）和 Q2（S-N）从预设题库随机抽取，不依赖 LLM；
 * Q3-Q6 由 LLM 生成（from=3），让用户答 Q1+Q2 期间有足够时间完成生成。
 *
 * 修改 scoreMap 时必须同步下游 section prompt（尤其是 overview.personality）。
 */
import type { QuizQuestion } from "@/lib/types";

export const QUIZ_SKELETON = [
  {
    id: "q1",
    dimension: "E-I" as const,
    scoreMap: { A: { E: 2 }, B: { I: 2 }, C: { E: 1 }, D: { I: 1 } } as const,
  },
  {
    id: "q2",
    dimension: "S-N" as const,
    scoreMap: { A: { S: 2 }, B: { N: 2 }, C: { S: 1 }, D: { N: 1 } } as const,
  },
  {
    id: "q3",
    dimension: "T-F" as const,
    scoreMap: { A: { T: 2 }, B: { F: 2 }, C: { T: 1 }, D: { F: 1 } } as const,
  },
  {
    id: "q4",
    dimension: "J-P" as const,
    scoreMap: { A: { J: 2 }, B: { P: 2 }, C: { J: 1 }, D: { P: 1 } } as const,
  },
  {
    id: "q5",
    dimension: "risk" as const,
    scoreMap: {
      A: { stable: 2 },
      B: { growth: 2 },
      C: { stable: 1 },
      D: { growth: 1 },
    } as const,
  },
  {
    id: "q6",
    dimension: "value" as const,
    scoreMap: {
      A: { salary: 2 },
      B: { interest: 2 },
      C: { impact: 2 },
      D: { balance: 2 },
    } as const,
  },
];

/** LLM 只吐这个形状：题目 + A/B/C/D 文本。 */
export interface AiQuizItem {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface AiQuizResponse {
  questions: AiQuizItem[];
}

/**
 * AI 输出 + 骨架合并为完整 QuizQuestion[]。
 * 字段缺失时兜底为空串，上游用 isMergedQuizComplete 判断是否降级静态题库。
 */
export function mergeQuizSkeleton(ai: AiQuizResponse, startIdx = 0): QuizQuestion[] {
  return QUIZ_SKELETON.slice(startIdx).map((slot, i) => {
    const q = ai?.questions?.[i];
    return {
      id: slot.id,
      dimension: slot.dimension,
      question: q?.question ?? "",
      options: (["A", "B", "C", "D"] as const).map((key) => ({
        key,
        label: q?.options?.[key] ?? "",
        score: { ...slot.scoreMap[key] },
      })),
    };
  });
}

/** 判断合并后的题目是否完整（题数匹配、每题文本+4 选项全非空）。 */
export function isMergedQuizComplete(questions: QuizQuestion[], expectedCount?: number): boolean {
  const expected = expectedCount ?? QUIZ_SKELETON.length;
  if (questions.length !== expected) return false;
  return questions.every((q) => {
    if (!q.question.trim()) return false;
    if (q.options.length !== 4) return false;
    return q.options.every((opt) => opt.label.trim().length > 0);
  });
}

/* ============================================================
   Q1 题库（E-I 维度，5 题）—— 随机抽取
   ============================================================ */

export const STATIC_Q1_BANK: QuizQuestion[] = [
  {
    id: "q1",
    dimension: "E-I",
    question: "面对一个复杂的技术难题，你倾向于？",
    options: [
      { key: "A", label: "先自己深入研究，形成方案后再与团队讨论", score: { I: 2 } },
      { key: "B", label: "立刻拉上同事头脑风暴，一起找解法", score: { E: 2 } },
      { key: "C", label: "查阅文档和案例，再根据实际情况决定", score: { I: 1 } },
      { key: "D", label: "根据紧急程度灵活调整，没有固定偏好", score: { E: 1 } },
    ],
  },
  {
    id: "q1",
    dimension: "E-I",
    question: "你在做项目决策时，更倾向于？",
    options: [
      { key: "A", label: "独立思考，形成清晰逻辑后再推进", score: { I: 2 } },
      { key: "B", label: "广泛收集用户和团队反馈，集思广益", score: { E: 2 } },
      { key: "C", label: "结合数据和直觉综合判断", score: { I: 1 } },
      { key: "D", label: "视项目阶段和资源灵活选择", score: { E: 1 } },
    ],
  },
  {
    id: "q1",
    dimension: "E-I",
    question: "处理工作问题时，你更倾向于？",
    options: [
      { key: "A", label: "先分析数据，独立拟定方案再执行", score: { I: 2 } },
      { key: "B", label: "马上与相关方沟通，协同推进", score: { E: 2 } },
      { key: "C", label: "根据问题性质和紧急度决定策略", score: { I: 1 } },
      { key: "D", label: "没有明显偏好，视情况而定", score: { E: 1 } },
    ],
  },
  {
    id: "q1",
    dimension: "E-I",
    question: "在工作中遇到新项目，你通常会？",
    options: [
      { key: "A", label: "先独立研究，建立自己的理解框架", score: { I: 2 } },
      { key: "B", label: "积极与团队交流，快速建立共识", score: { E: 2 } },
      { key: "C", label: "根据项目类型和规模灵活调整", score: { I: 1 } },
      { key: "D", label: "没有特别偏好，随机应变", score: { E: 1 } },
    ],
  },
  {
    id: "q1",
    dimension: "E-I",
    question: "小组作业分工时，你通常会？",
    options: [
      { key: "A", label: "主动组织会议、分配任务，推动整体进度", score: { E: 2 } },
      { key: "B", label: "领一块自己擅长的部分，独立完成后合并", score: { I: 2 } },
      { key: "C", label: "看团队需要，需要协调就协调，需要执行就执行", score: { E: 1 } },
      { key: "D", label: "偏好文字沟通胜过面对面讨论", score: { I: 1 } },
    ],
  },
];

/** 从 Q1 题库随机抽一题 */
export function pickStaticQ1(): QuizQuestion {
  return STATIC_Q1_BANK[Math.floor(Math.random() * STATIC_Q1_BANK.length)];
}

/* ============================================================
   Q2 题库（S-N 维度，5 题）—— 随机抽取
   ============================================================ */

export const STATIC_Q2_BANK: QuizQuestion[] = [
  {
    id: "q2",
    dimension: "S-N",
    question: "学习一项新技能时，你更倾向于？",
    options: [
      { key: "A", label: "找官方文档，从基础概念一步步跟着做", score: { S: 2 } },
      { key: "B", label: "先看别人的实战案例，了解这技能能做什么", score: { N: 2 } },
      { key: "C", label: "对着教程动手练，边做边理解", score: { S: 1 } },
      { key: "D", label: "先想清楚自己要用它解决什么问题，再选择性学", score: { N: 1 } },
    ],
  },
  {
    id: "q2",
    dimension: "S-N",
    question: "做需求分析时，你更看重？",
    options: [
      { key: "A", label: "用户调研数据和实际使用场景", score: { S: 2 } },
      { key: "B", label: "行业趋势和竞品的创新方向", score: { N: 2 } },
      { key: "C", label: "现有功能的用户反馈和痛点", score: { S: 1 } },
      { key: "D", label: "产品未来的延展性和想象空间", score: { N: 1 } },
    ],
  },
  {
    id: "q2",
    dimension: "S-N",
    question: "策划一个活动时，你会优先考虑？",
    options: [
      { key: "A", label: "预算、场地、人数等具体执行细节", score: { S: 2 } },
      { key: "B", label: "活动主题是否有新意、能否出圈", score: { N: 2 } },
      { key: "C", label: "参考过往成功案例，优化流程", score: { S: 1 } },
      { key: "D", label: "思考这次活动能带来什么长期价值", score: { N: 1 } },
    ],
  },
  {
    id: "q2",
    dimension: "S-N",
    question: "评估一个新项目方案时，你更关注？",
    options: [
      { key: "A", label: "已有的数据和真实用户反馈", score: { S: 2 } },
      { key: "B", label: "未来的趋势和潜在可能性", score: { N: 2 } },
      { key: "C", label: "当下能否落地执行", score: { S: 1 } },
      { key: "D", label: "是否符合长期战略方向", score: { N: 1 } },
    ],
  },
  {
    id: "q2",
    dimension: "S-N",
    question: "选择研究方向或课题时，你更倾向于？",
    options: [
      { key: "A", label: "选数据充分、方法成熟的方向，稳妥出成果", score: { S: 2 } },
      { key: "B", label: "选前沿交叉领域，虽然资料少但有探索空间", score: { N: 2 } },
      { key: "C", label: "跟着前辈推荐走，重在按时完成", score: { S: 1 } },
      { key: "D", label: "找一个能和未来职业方向挂钩的题目", score: { N: 1 } },
    ],
  },
];

/** 从 Q2 题库随机抽一题 */
export function pickStaticQ2(): QuizQuestion {
  return STATIC_Q2_BANK[Math.floor(Math.random() * STATIC_Q2_BANK.length)];
}

/* ============================================================
   占位题和兜底题
   ============================================================ */

/** Q3-Q6 占位符（等 LLM 生成填充） */
export const PLACEHOLDER_Q3_TO_Q6: QuizQuestion[] = QUIZ_SKELETON.slice(2).map((q) => ({
  id: q.id,
  dimension: q.dimension,
  question: "正在为你定制题目...",
  options: [] as QuizQuestion["options"],
}));

/** @deprecated 保留向后兼容，新代码用 PLACEHOLDER_Q3_TO_Q6 */
export const PLACEHOLDER_Q2_TO_Q6: QuizQuestion[] = QUIZ_SKELETON.slice(1).map((q) => ({
  id: q.id,
  dimension: q.dimension,
  question: "正在为你定制题目...",
  options: [] as QuizQuestion["options"],
}));

/** 客户端全量兜底 Q3-Q6（LLM + prefetch 全挂时） */
export const STATIC_FALLBACK_Q3_TO_Q6: QuizQuestion[] = [
  {
    id: "q3",
    dimension: "T-F",
    question: "小组作业里出现意见分歧时，你更愿意：",
    options: [
      { key: "A", label: "用逻辑和数据据理力争", score: { T: 2 } },
      { key: "B", label: "先照顾每个人的感受再谈方案", score: { F: 2 } },
      { key: "C", label: "直接拍板推进，效率优先", score: { T: 1 } },
      { key: "D", label: "寻找折衷，让大家都能接受", score: { F: 1 } },
    ],
  },
  {
    id: "q4",
    dimension: "J-P",
    question: "面对求职投递季，你通常的节奏是：",
    options: [
      { key: "A", label: "提前 3 个月列好清单，按计划推进", score: { J: 2 } },
      { key: "B", label: "随机应变，遇到机会就投", score: { P: 2 } },
      { key: "C", label: "设定大目标，过程灵活调整", score: { J: 1 } },
      { key: "D", label: "临近截止才集中发力", score: { P: 1 } },
    ],
  },
  {
    id: "q5",
    dimension: "risk",
    question: "同时拿到两份 offer，你会怎么选：",
    options: [
      { key: "A", label: "成熟大厂，培养体系完整、薪资稳定", score: { stable: 2 } },
      { key: "B", label: "高速成长的初创，空间大但节奏快", score: { growth: 2 } },
      { key: "C", label: "看行业头部，其他都可以考虑", score: { stable: 1 } },
      { key: "D", label: "看直属 leader 和团队氛围", score: { growth: 1 } },
    ],
  },
  {
    id: "q6",
    dimension: "value",
    question: "对你而言，这份工作最重要的是：",
    options: [
      { key: "A", label: "薪资和福利", score: { salary: 2 } },
      { key: "B", label: "做感兴趣的事", score: { interest: 2 } },
      { key: "C", label: "在好的平台带来行业影响力", score: { impact: 2 } },
      { key: "D", label: "工作和生活保持平衡", score: { balance: 2 } },
    ],
  },
];
