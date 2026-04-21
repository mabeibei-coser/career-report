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

只写 2 个主题，不写别的：

A. aiExperience — AI 应用经验
   - summary：60-100 字，直接讲 HR / 业务方如何评估候选人的 AI 能力，以及这点能撬动多少薪资空间
   - points：恰好 3 条，**每条 40-80 字完整句子**（不是短语 / 不是标题），动词开头，含：
     * 具体动作或产物
     * 涉及的工具 / 场景 / 平台
     * 可验证的结果或面试怎么讲

B. internshipExperience — 企业实习成果案例
   - summary：60-100 字，直接讲 HR 最看重实习里哪一点，以及这点如何成为谈薪筹码
   - points：恰好 3 条，**每条 40-80 字完整句子**，动词开头，具体到：
     * 要准备什么材料 / 证据
     * 放在什么地方（简历 / 作品集 / 面试开场）
     * 面试时怎么呈现给 HR

**禁止**：超短条目（"掌握 AI 工具"、"准备作品集" 这种 4-6 字标题体都不允许）、空洞套话。每一条都要让应届生读完知道**具体该做什么**。

严格输出 JSON：

{
  "aiExperience": { "summary": "...", "points": ["...", "...", "..."] },
  "internshipExperience": { "summary": "...", "points": ["...", "...", "..."] }
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
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请为"${formData.targetPosition}"意向"${formData.targetCompany}"的应届候选人，只就 AI 应用经验 和 企业实习成果 两个主题给出谈薪要点。`;
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
