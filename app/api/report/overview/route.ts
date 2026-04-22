import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, Overview, QuizAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招定位分析师，输出"总览"章节 JSON。

${APPLICANT_BASELINE}

**铁律**：客观分析语气，不写鸡汤。禁止"整体而言/总体来看/可以说/应该说/是一位…的候选人"，禁止形容词堆砌（突出/坚实/强劲/亮眼），禁止"未来可期/潜力大"类空话。

字段要求：

1. positioning（40-70 字）：一句核心定位判断，必须含至少 2 个具体信号（擅长 X + 卡在 Y）。示例："B 端 PM 方向的结构化共情型候选人——擅长把业务诉求翻译成 PRD，但缺商业量化和数据分析历练。"
2. summary：2-3 短句，分别讲定位、优势、最大短板。
3. strength：{title: 2-4 字凝练, detail: 40-60 字说这点在校招哪种场合变筹码}
4. improvement：{title: 2-4 字, detail: 40-60 字，问题 + 可执行动作（数字+频率）}
5. personality（基于 6 题测评）：
   - type：MBTI 四字母 + 4-6 字中文定位，如 "ENFJ · 温和型推动者"
   - traits：3-4 个 2-4 字中文标签
   - description（80-120 字）：这种性格在校招场景的实际表现——最受欢迎的场合 + 最容易掉坑的场合，白描不鸡汤`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData, quizAnswers } = body as {
      formData: JobFormData;
      quizAnswers: QuizAnswer[];
    };
    if (!formData?.targetPosition) {
      return NextResponse.json({ error: "缺少意向信息" }, { status: 400 });
    }
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请严格按约定 JSON 输出"总览"章节。`;
    const data = await callMiniMaxJson<Overview>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.6,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("overview section error:", error);
    const message = error instanceof Error ? error.message : "总览章节生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
