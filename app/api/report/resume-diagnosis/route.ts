import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callWithFallback,
} from "@/lib/report-shared";
import type {
  JobFormData,
  QuizAnswer,
  ResumeDiagnosis,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是一位资深校招简历教练，为应届大学生的简历给出诊断与改进建议。

${APPLICANT_BASELINE}

应届生简历的典型问题：
- 实习经历描述太流程化，缺少量化成果（没有数字 / 对比 / 影响范围）
- 校园项目只堆技术栈，没说清楚个人贡献
- 技能罗列扁平，没有体现主次和熟练度
- 缺少 STAR 结构（情境/任务/行动/结果）
- 自我评价或目标描述空泛
- 关键词与意向岗位 JD 不对齐

严格输出以下 JSON：

{
  "overallScore": 0-100,
  "recommendations": [
    {
      "title": "简短问题标题",
      "issue": "在简历中发现的具体问题（50-80 字）",
      "suggestion": "可操作的改进建议（60-120 字）",
      "priority": "high" | "medium" | "low",
      "quotedSnippet": "从用户简历原文中摘取的一小段原文（20-50 字）"
    }
  ]
}

要求：
1. recommendations 必须恰好 3 条
2. 至少有 1 条 priority = "high"
3. 每条都尽量附 quotedSnippet，来自用户真实简历；如实在无法对应，可省略该字段
4. 不要虚构简历里没有的内容
5. overallScore 反映总体完成度（应届视角，60-80 偏常见）`;

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

    if (!formData.resumeText || formData.resumeText.length < 50) {
      // No resume: return null instead of invoking AI
      return NextResponse.json({ data: null });
    }

    // 静态指令前置，buildBaseContext 的动态简历内容后置 —— 吃 MiniMax 自动前缀缓存
    const userPrompt = `请基于下面的简历内容输出 JSON 形式的简历诊断（3 条建议，含从简历摘取的原文片段）。\n\n${buildBaseContext(formData, quizAnswers, interviewSummary)}`;
    const data = await callWithFallback<ResumeDiagnosis>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1400,
      temperature: 0.5,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("resume-diagnosis section error:", error);
    const message = error instanceof Error ? error.message : "简历诊断生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
