import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  FORBIDDEN_FRAUD_NOTE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, NegotiationTips, QuizAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招薪资顾问，输出"谈薪要点"章节。

${APPLICANT_BASELINE}

${FORBIDDEN_FRAUD_NOTE}

**语气铁律**（违反即失败）：
- 禁止 "可以说 / 总的来说 / 应届同学 / 让自己 / 相当于给自己加"
- 禁止形容词堆砌（"稀缺""硬核""亮眼""漂亮"）
- 禁止鸡汤式语气
- summary 必须是**事实陈述**，不能是 pep-talk

只写 2 个主题的 summary，不写别的：

A. aiExperience — AI 应用经验
   - summary：80-120 字，直接讲 HR / 业务方如何评估候选人的 AI 能力，这点能撬动多少薪资空间，以及应届生需要做到哪几步（工具链 / 能力边界判断 / 可展示案例）

B. internshipExperience — AI 相关的企业实习成果案例
   - summary：80-120 字，直接讲 HR 如何看待候选人在实习里用 AI 做出的成果（而不是任意实习），这点为何成为谈薪筹码，以及应届生需要准备哪些材料 / 证据 / 展示方式

每段 summary 要信息密度高、具体到动作，不允许写成 pep-talk 或口号式总结。

严格输出 JSON：

{
  "aiExperience": { "summary": "..." },
  "internshipExperience": { "summary": "..." }
}`;

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
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请为"${formData.targetPosition}"意向"${formData.targetCompany}"的应届候选人，只就 AI 应用经验 和 AI 相关的企业实习成果 两个主题给出谈薪要点（仅 summary，各一段）。`;
    const data = await callMiniMaxJson<NegotiationTips>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1100,
      temperature: 0.6,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("negotiation section error:", error);
    const message = error instanceof Error ? error.message : "谈薪要点生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
