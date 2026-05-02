import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { callWithFallback } from "@/lib/report-shared";
import { synthesizeTTS } from "@/lib/volc-tts";
import {
  pickNextQuestion,
  INTERVIEW_QUESTION_BANK,
} from "@/lib/interview-questions";
import type { InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const GREETING_TEXT =
  "你好，我是你的 AI 职业顾问，接下来我会问你两个问题，帮你完善这份定位报告。";

const PUBLIC_AUDIO_DIR = path.resolve(process.cwd(), "public", "audio");

/** 静态 mp3 文件存在则返回 url，否则返回 null（后续会走 live TTS 兜底） */
function staticAudioUrl(name: string): string | null {
  const filePath = path.join(PUBLIC_AUDIO_DIR, `${name}.mp3`);
  return existsSync(filePath) ? `/audio/${name}.mp3` : null;
}

// POST /api/interview/question
// Inputs:
//   { greeting: true } → 开场白（优先静态 mp3，否则 live TTS）
//   { previousTurns: [] } → 题库随机抽 Q1（按 id 命中静态 mp3）
//   { previousTurns: [t1], excludeQuestionIds?: [...] } → LLM 追问（2s 超时）→ 失败回落题库
// Output: { text, audioUrl?, audioBase64?, questionId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const greeting: boolean = body?.greeting === true;
    const previousTurns: InterviewTurn[] | undefined = body?.previousTurns;
    const excludeIds: string[] = Array.isArray(body?.excludeQuestionIds)
      ? body.excludeQuestionIds
      : [];

    if (greeting) {
      const cachedUrl = staticAudioUrl("greeting");
      if (cachedUrl) {
        return NextResponse.json({ text: GREETING_TEXT, audioUrl: cachedUrl });
      }
      // 静态 mp3 不存在 → live TTS 兜底
      let audioBase64 = "";
      try {
        audioBase64 = await synthesizeTTS(GREETING_TEXT);
      } catch {
        // TTS 失败不致命，前端按静默处理
      }
      return NextResponse.json({ text: GREETING_TEXT, audioBase64 });
    }

    let questionText: string;
    let questionId: string | undefined;
    let isFromBank = false;

    if (!previousTurns || previousTurns.length === 0) {
      // Q1: 从题库随机抽
      const picked = pickNextQuestion();
      questionText = picked.text;
      questionId = picked.id;
      isFromBank = true;
    } else if (previousTurns.length === 1) {
      // Q2: LLM 追问（2s 超时）→ 失败回落题库
      const turn1 = previousTurns[0];
      const systemPrompt =
        "你是一位专业的 AI 面试官。基于候选人对'职业心态'类问题的回答，生成一个自然的追问（50-80 字开放式问题，一句话）。聚焦候选人提到的具体细节，引导对方深入而不是重复总结；语气像朋友聊天，不要过于正式。只输出合法 JSON：{ \"text\": \"追问内容\" }";
      const userPrompt = `候选人刚回答的问题：${turn1.questionText}\n候选人回答：${turn1.userAnswerText || "（未作答）"}\n请生成一个针对其回答细节的追问。`;

      try {
        const result = await Promise.race([
          callWithFallback<{ text: string }>({
            systemPrompt,
            userPrompt,
            maxTokens: 200,
            temperature: 0.7,
            validator: (d) => (d.text?.trim() ? null : "text empty"),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Q2 LLM timeout 2s")), 2000)
          ),
        ]);
        questionText = result.text.trim();
        // 追问没有 questionId（LLM 自由生成）→ 不来自题库
      } catch (err) {
        console.warn(
          "[interview/question] Q2 LLM failed/timeout, fallback to bank:",
          err
        );
        const fallback = pickNextQuestion(excludeIds);
        questionText = fallback.text;
        questionId = fallback.id;
        isFromBank = true;
      }
    } else {
      return NextResponse.json(
        { error: "不支持超过 2 轮的对话" },
        { status: 400 }
      );
    }

    // 命中题库 + 有静态 mp3 → 返回 audioUrl
    if (isFromBank && questionId) {
      const cachedUrl = staticAudioUrl(questionId);
      if (cachedUrl) {
        return NextResponse.json({
          text: questionText,
          audioUrl: cachedUrl,
          questionId,
          bankSize: INTERVIEW_QUESTION_BANK.length,
        });
      }
    }

    // 动态 LLM 追问 / 静态 mp3 缺失 → live TTS
    let audioBase64 = "";
    try {
      audioBase64 = await synthesizeTTS(questionText);
    } catch (ttsErr) {
      console.warn(
        "[interview/question] TTS failed, continuing silently:",
        ttsErr
      );
    }

    return NextResponse.json({
      text: questionText,
      audioBase64,
      questionId,
      bankSize: INTERVIEW_QUESTION_BANK.length,
    });
  } catch (error: unknown) {
    console.error("[interview/question] route error:", error);
    const message = error instanceof Error ? error.message : "面试问题生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
