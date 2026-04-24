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
export function mergeQuizSkeleton(ai: AiQuizResponse): QuizQuestion[] {
  return QUIZ_SKELETON.map((slot, i) => {
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
