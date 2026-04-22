import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type {
  JobFormData,
  PositionInfo,
  QuizAnswer,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是一位资深校招岗位规划师，为应届大学生生成"岗位信息"章节。

${APPLICANT_BASELINE}

该章节要在意向岗位的大类之下，给出 2 个细分岗位方向，并标明首选 / 次选。
严格输出以下 JSON，不加额外文字：

{
  "subPositions": [
    {
      "name": "细分岗位名",
      "priority": "primary" | "secondary",
      "coreResponsibilities": ["核心职责1（含应届可承担范围）", "..."],
      "coreCompetencies": [
        {"name":"能力维度","score": 0-100,"description":"为什么该能力对这个岗位重要（应届校招要求）"}
      ],
      "fitReason": "80-120 字，说明为什么这个细分方向适合当前候选人"
    }
  ]
}

要求：
1. subPositions 必须恰好 2 个，priority 分别是 primary、secondary（顺序对应首选 / 次选）
2. 每个 subPosition 的 coreResponsibilities 为 3-5 条
3. 每个 subPosition 的 coreCompetencies 为恰好 5 个能力维度（用于雷达图），score 反映"该岗位对该能力的重要度+该同学当前匹配度的综合评估"，范围 0-100
4. 细分岗位要和用户意向岗位强相关（例：意向"产品经理"可细分"B端产品""C端产品"；意向"数据分析师"可细分"业务分析师""产品数据分析师"）
5. 每个能力描述 30-60 字，避免空泛
6. **fitReason 必须基于候选人的真实信息**（铁律，违反即失败）：
   - 首选 / 次选每个 fitReason 必须引用**至少 1 条性格测评答案**的具体观察（例"测评显示你 J 倾向偏强"、"你在第 4 题选了偏结构化的选项"）
   - 如有简历，必须引用**至少 1 条简历证据**（例"你在 X 实习中做过需求梳理"）
   - 首选方向要讲清**为什么 TA 比次选方向更适合**
   - **禁止开头用"因为你..."这种 AI 模板**；先铺事实 → 再下判断
   - 语气直接、无套话，句子短促`;

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
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请为"${formData.targetPosition}"这个意向岗位生成岗位信息 JSON（2 个细分岗位 + 每个 5 维能力）。`;
    const data = await callMiniMaxJson<PositionInfo>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.55,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("position-info section error:", error);
    const message = error instanceof Error ? error.message : "岗位信息生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
