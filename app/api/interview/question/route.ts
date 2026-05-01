import { NextRequest, NextResponse } from "next/server";
import { callWithFallback } from "@/lib/report-shared";
import { synthesizeTTS } from "@/lib/volc-tts";
import type { InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const STATIC_FALLBACK_Q2 = "在这段经历里，你最大的挑战是什么？以及它怎么改变了你？";

// POST /api/interview/question
// Input: { targetPosition: string, previousTurns?: InterviewTurn[] }
// Output: { text: string, audioBase64: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targetPosition: string | undefined = body?.targetPosition;
    const previousTurns: InterviewTurn[] | undefined = body?.previousTurns;

    if (!targetPosition?.trim()) {
      return NextResponse.json({ error: "缺少意向岗位信息" }, { status: 400 });
    }

    let questionText: string;

    if (!previousTurns || previousTurns.length === 0) {
      // Turn 0: fixed template, no LLM call
      questionText = `假设你正在向意向公司的面试官介绍自己。请用 1-2 分钟讲一段最能证明你适合「${targetPosition}」的经历——可以是校园项目、实习、竞赛或社团经历，重点说说你做了什么、解决了什么问题。`;
    } else if (previousTurns.length === 1) {
      // Turn 1: LLM follow-up question
      const turn1 = previousTurns[0];
      const systemPrompt =
        "你是一位专业的校招 AI 面试官。基于候选人刚才的回答，生成一个自然的追问（50-80字开放式问题，不要超过一句话）。只输出合法JSON：{ \"text\": \"追问内容\" }";
      const userPrompt = `候选人回答了第一题后。\n第一题：${turn1.questionText}\n候选人回答：${turn1.userAnswerText}\n请生成追问。`;

      try {
        const result = await callWithFallback<{ text: string }>({
          systemPrompt,
          userPrompt,
          maxTokens: 200,
          temperature: 0.7,
          validator: (d) => (d.text?.trim() ? null : "text empty"),
        });
        questionText = result.text.trim();
      } catch {
        questionText = STATIC_FALLBACK_Q2;
      }
    } else {
      return NextResponse.json(
        { error: "不支持超过 2 轮的对话" },
        { status: 400 }
      );
    }

    // TTS — failure is non-fatal, client handles silent mode
    let audioBase64 = "";
    try {
      audioBase64 = await synthesizeTTS(questionText);
    } catch (ttsErr) {
      console.warn("[interview/question] TTS failed, continuing silently:", ttsErr);
    }

    return NextResponse.json({ text: questionText, audioBase64 });
  } catch (error: unknown) {
    console.error("[interview/question] route error:", error);
    const message = error instanceof Error ? error.message : "面试问题生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
