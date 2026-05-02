import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callWithFallback,
} from "@/lib/report-shared";
import { normalizeStringLikeFields, asText } from "@/lib/text-normalize";
import type { JobFormData, QuizAnswer, WorkplaceInsight } from "@/lib/types";
import { workplaceInsightMock } from "@/lib/mocks/report-mocks";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招市场观察员，输出"职场环境透视"章节的 JSON。

${APPLICANT_BASELINE}

**铁律**：
- 禁止套话（整体而言/值得注意的是/可以说）、禁止形容词堆砌
- observations 必须归因公开渠道（脉脉/小红书/知乎/JD），严禁杜撰姓名/内部薪资/违法指控
- attentions 必须动词开头具体到"查什么字段/对比什么"
- **所有行业语境必须与上下文里"系统推断行业"完全一致**；不要基于公司名字面（如"建设""建工""电力"等通用词）做跨行业联想。例如上下文推断行业是"金融/银行"，就算公司名带"建设"二字，也只写金融领域的趋势和观察

输出以下顶层字段（严格按 schema，**字符串字段请直接给字符串，不要包成 {summary: "..."} 嵌套对象**）：

1. industryAdvice.summary（字符串，80-120 字）：行业趋势 + 2-3 个可观察信号（数字/岗位名/趋势），完整句子不要短语拼凑

2. companyInsight：
   - targetLabel（字符串）：原样回显用户填写的意向公司名
   - developmentSummary（字符串，80-120 字）：该公司近 12 个月发展现状（市场地位/业务动向/用人偏好），归因"据 2024-2025 公开财报/媒体报道/JD 动态"，不和 observations 重复
   - summary（字符串，40-60 字）：说明 observations 基于哪些渠道和时间范围
   - observations：恰好 3 条，每条 {source: 来源标签差异化, voice: 60-100 字针对这家公司的具体观察，含职级/比例/强度等可验证细节}
   - attentions：恰好 2 条签约前动作，每条 25-40 字字符串，动词开头

3. synthesis（**字符串**，60-90 字）：收束成"对这家公司该怎么决策"的具体建议；**必须是字符串，不是 {summary: "..."} 对象**`;

export async function POST(req: NextRequest) {
  if (process.env.E2E_MOCK_MODE === "true") {
    return NextResponse.json({ data: workplaceInsightMock });
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
    // 静态指令前置，buildBaseContext 的动态内容后置 —— 吃 MiniMax 自动前缀缓存
    const userPrompt = `请基于公开网络对用户意向公司的反馈（脉脉/小红书/知乎/校招贴吧），给出 companyInsight.observations；targetLabel 必须原样回显用户填写的意向公司名称。\n\n${buildBaseContext(formData, quizAnswers, interviewSummary)}`;
    const data = await callWithFallback<WorkplaceInsight>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1600,
      temperature: 0.55,
    });

    // Shape normalize：AI 偶尔把 string 字段包成 {summary: "..."} 返回，直接在前端
    // 渲染会抛 React error #31（Objects are not valid as a React child）。
    // 这里在 API 边界强制解包，前端组件里再加一层 asText 兜底
    if (data) {
      normalizeStringLikeFields(data as unknown as Record<string, unknown>, [
        "synthesis",
      ]);
      if (data.companyInsight) {
        normalizeStringLikeFields(
          data.companyInsight as unknown as Record<string, unknown>,
          ["summary", "developmentSummary", "targetLabel"]
        );
        // attentions 是字符串数组，每项也兜一层
        if (Array.isArray(data.companyInsight.attentions)) {
          data.companyInsight.attentions = data.companyInsight.attentions.map(
            (a) => asText(a)
          );
        }
      }
      if (data.industryAdvice) {
        normalizeStringLikeFields(
          data.industryAdvice as unknown as Record<string, unknown>,
          ["summary"]
        );
      }
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("workplace-insight section error:", error);
    const message =
      error instanceof Error ? error.message : "职场环境透视生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
