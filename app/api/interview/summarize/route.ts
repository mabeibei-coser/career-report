export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { callWithFallback } from "@/lib/report-shared";
import type { InterviewTurn } from "@/lib/types";

// POST /api/interview/summarize
// Input: { turns: InterviewTurn[], targetPosition: string }
// Output: { summary: string }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const turns: InterviewTurn[] = body.turns ?? [];
  const targetPosition: string = body.targetPosition ?? "";

  if (turns.length === 0) {
    return NextResponse.json({ summary: "" });
  }

  // Build prompt from turns
  const turnsText = turns
    .map((turn, i) => {
      return `轮次 ${i + 1}：\nQ: ${turn.questionText}\nA: ${turn.userAnswerText}`;
    })
    .join("\n\n");

  try {
    const result = await callWithFallback<{ summary: string }>({
      systemPrompt: `你是一位专业的校招辅导老师。根据候选人在 AI 访谈中的回答，写一段 200-300 字的访谈摘要，供后续生成职业定位报告使用。重点提炼：候选人的核心经历、展现的能力和潜力、与「${targetPosition}」岗位的关联。风格：精炼、客观、第三人称。只输出合法 JSON：{ "summary": "..." }`,
      userPrompt: turnsText,
      validator: (d) => ((d.summary?.length ?? 0) > 20 ? null : "summary too short"),
      timeoutMs: 20000,
    });

    return NextResponse.json({ summary: result.summary });
  } catch {
    // Fallback: join all answer texts with newline
    const fallbackSummary = turns.map((t) => t.userAnswerText).join("\n");
    return NextResponse.json({ summary: fallbackSummary });
  }
}
