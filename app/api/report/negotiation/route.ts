import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  FORBIDDEN_FRAUD_NOTE,
  buildBaseContext,
  callWithFallback,
} from "@/lib/report-shared";
import { asText } from "@/lib/text-normalize";
import type { JobFormData, NegotiationTips, QuizAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招薪资顾问，输出"谈薪要点"章节的两段 summary。

${APPLICANT_BASELINE}

${FORBIDDEN_FRAUD_NOTE}

**语气铁律**：summary 必须是事实陈述，不能是 pep-talk。禁止"可以说/总的来说/应届同学/让自己/相当于给自己加"，禁止形容词堆砌（稀缺/硬核/亮眼/漂亮），禁止鸡汤。

输出 JSON 对象，**有且必须有两个顶层字段**（缺一不可，每个都必须填实质内容，禁止空字符串/省略号/不足 80 字/缺省）：

1. aiExperience.summary（字符串，80-120 字）
   内容必须讲清楚三点：HR / 业务方如何评估候选人的 AI 能力；这点能撬动多少薪资空间；应届生需要做到哪几步（工具链 / 能力边界判断 / 可展示案例）。

2. internshipExperience.summary（字符串，80-120 字）
   内容必须讲清楚三点：HR 如何看待候选人在实习里用 AI 做出的成果（强调"AI 相关"，不是任意实习）；为何这成为谈薪筹码；应届生需要准备什么材料/证据/展示方式。

**两个字段都不能省**。返回 shape 严格为 \`{ "aiExperience": { "summary": "..." }, "internshipExperience": { "summary": "..." } }\`，不要平铺、不要嵌套到其他键名。`;

type RawNegotiation = {
  aiExperience?: unknown;
  internshipExperience?: unknown;
};

function unwrapSummary(node: unknown): string {
  if (typeof node === "string") return node;
  return asText(node);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData, quizAnswers, interviewSummary } = body as {
      formData: JobFormData;
      quizAnswers: QuizAnswer[];
      interviewSummary?: string;
    };
    if (!formData?.targetPosition) {
      return NextResponse.json({ error: "缺少意向信息" }, { status: 400 });
    }
    // 静态指令前置，buildBaseContext 的动态内容后置 —— 吃 MiniMax 自动前缀缓存
    const userPrompt = `只就 AI 应用经验 和 AI 相关的企业实习成果 两个主题给出谈薪要点（aiExperience.summary 和 internshipExperience.summary 两段，缺一不可），针对用户的意向岗位与意向公司/类型的应届候选人。\n\n${buildBaseContext(formData, quizAnswers, interviewSummary)}`;
    const raw = await callWithFallback<RawNegotiation>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 900,
      temperature: 0.55,
      validator: (d) => {
        const ai = unwrapSummary(d?.aiExperience);
        const intern = unwrapSummary(d?.internshipExperience);
        if (ai.length < 60) return "aiExperience.summary 缺失或过短（需 ≥60 字）";
        if (intern.length < 60) return "internshipExperience.summary 缺失或过短（需 ≥60 字）";
        return null;
      },
    });

    // 归一化：兼容 LLM 偶发的 flat string / 嵌套差异
    const data: NegotiationTips = {
      aiExperience: { summary: unwrapSummary(raw.aiExperience) },
      internshipExperience: { summary: unwrapSummary(raw.internshipExperience) },
    };

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("negotiation section error:", error);
    const message = error instanceof Error ? error.message : "谈薪要点生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
