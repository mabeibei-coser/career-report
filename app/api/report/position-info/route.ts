import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callWithFallback,
} from "@/lib/report-shared";
import type {
  JobFormData,
  PositionInfo,
  QuizAnswer,
} from "@/lib/types";
import { positionInfoMock } from "@/lib/mocks/report-mocks";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招岗位规划师，输出"岗位信息"章节 JSON。

${APPLICANT_BASELINE}

在意向岗位大类下给出 2 个细分方向（首选 + 次选）。

输出字段：subPositions 数组恰好 2 项，每项：
- name：细分岗位名（如"B 端产品""C 端产品"；"业务分析师""产品数据分析师"）
- priority："primary" | "secondary"
- coreResponsibilities：3 条，应届可承担范围
- coreCompetencies：恰好 5 个 {name, score(0-100), description(20-40 字)}
- fitReason：60-90 字，必须引用至少 1 条测评答案 + 1 条简历证据（如有简历）；首选要讲清为什么比次选更适合；句子短促无套话，禁止"因为你..."模板

铁律：coreCompetencies 必须恰好 5 个（雷达图需要），subPositions 必须恰好 2 个。`;

export async function POST(req: NextRequest) {
  if (process.env.E2E_MOCK_MODE === "true") {
    return NextResponse.json({ data: positionInfoMock });
  }
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
    // 静态指令前置，buildBaseContext 的动态内容后置 —— 吃 DeepSeek 自动前缀缓存
    const userPrompt = `请为用户的意向岗位生成岗位信息 JSON（2 个细分岗位 + 每个 5 维能力）。\n\n${buildBaseContext(formData, quizAnswers, interviewSummary)}`;
    const data = await callWithFallback<PositionInfo>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1400,
      temperature: 0.55,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("position-info section error:", error);
    const message = error instanceof Error ? error.message : "岗位信息生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
