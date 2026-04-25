/**
 * 快测题骨架：6 道题的 id / dimension / scoreMap 硬编码，LLM 只需生成题目文本和选项文本。
 * 输出 token 减半（~2400→1200），讯飞生成时间相应减半（~12s→6s）。
 *
 * 维度与下游消费：
 *   E-I / S-N / T-F / J-P → overview.personality.type (MBTI)
 *   risk                 → overview.personality / positionInfo.fitReason
 *   value                → overview.personality / 谈薪相关推断
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

/** 判断合并后的题目是否完整（6 道题、每题文本+4 选项全非空）。 */
export function isMergedQuizComplete(questions: QuizQuestion[]): boolean {
  if (questions.length !== QUIZ_SKELETON.length) return false;
  return questions.every((q) => {
    if (!q.question.trim()) return false;
    if (q.options.length !== 4) return false;
    return q.options.every((opt) => opt.label.trim().length > 0);
  });
}

export const STATIC_Q1_VARIANTS: Record<
  "default" | "tech" | "product" | "operation",
  QuizQuestion
> = {
  tech: {
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
  product: {
    id: "q1",
    dimension: "E-I",
    question: "你在做产品决策时，更倾向于？",
    options: [
      { key: "A", label: "独立思考，形成清晰逻辑后再推进", score: { I: 2 } },
      { key: "B", label: "广泛收集用户和团队反馈，集思广益", score: { E: 2 } },
      { key: "C", label: "结合数据和直觉综合判断", score: { I: 1 } },
      { key: "D", label: "视项目阶段和资源灵活选择", score: { E: 1 } },
    ],
  },
  operation: {
    id: "q1",
    dimension: "E-I",
    question: "处理运营问题时，你更倾向于？",
    options: [
      { key: "A", label: "先分析数据，独立拟定方案再执行", score: { I: 2 } },
      { key: "B", label: "马上与相关方沟通，协同推进", score: { E: 2 } },
      { key: "C", label: "根据问题性质和紧急度决定策略", score: { I: 1 } },
      { key: "D", label: "没有明显偏好，视情况而定", score: { E: 1 } },
    ],
  },
  default: {
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
};

export function pickStaticQ1(formData: { targetPosition?: string }): QuizQuestion {
  const pos = (formData.targetPosition ?? "").toLowerCase();
  if (/开发|工程师|架构|前端|后端|算法|数据/.test(pos)) return STATIC_Q1_VARIANTS.tech;
  if (/产品|pm|需求|体验/.test(pos)) return STATIC_Q1_VARIANTS.product;
  if (/运营|增长|推广|渠道|市场/.test(pos)) return STATIC_Q1_VARIANTS.operation;
  return STATIC_Q1_VARIANTS.default;
}

export const PLACEHOLDER_Q2_TO_Q6: QuizQuestion[] = QUIZ_SKELETON.slice(1).map((q) => ({
  id: q.id,
  dimension: q.dimension,
  question: "正在为你定制题目...",
  options: [] as QuizQuestion["options"],
}));
