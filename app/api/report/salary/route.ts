import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import {
  cityCoefficients,
  buildSalaryAnchorPrompt,
} from "@/lib/salary-anchors";
import type {
  JobFormData,
  QuizAnswer,
  SalaryInsight,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystemPrompt(
  position: string,
  education?: string,
  resumeText?: string
): string {
  return `你是校招薪资分析师，输出"${position}岗位薪资"章节的结构化数据。

${APPLICANT_BASELINE}

${buildSalaryAnchorPrompt(position, education, resumeText)}

严格输出 JSON，不加任何解释文字：

{
  "quartiles": {"low": 数字, "median": 数字, "high": 数字, "unit": "元/月"},
  "industryComparison": [{"industry": "...", "avgSalary": 数字}],
  "userIndustry": {"industry": "...", "avgSalary": 数字, "note": "..."}
}

规则：
1. quartiles 基于锚点微调（含学历/简历加成后），应届真实水平，不虚高
2. industryComparison 恰好 5 条，**严格按 avgSalary 从高到低排序**（不要把用户意向塞到第 1 位），5 条的 industry 名称互不重复
3. userIndustry 单独输出：基于用户 targetCompany 推断其所属行业（例"互联网大厂"→"互联网/软件"、"某保险公司"→"金融/保险"），给出该行业应届薪资 avgSalary，以及 note 一句 15-30 字的定位话（例"高于行业中位约 XX%"、"稀缺但稳定"、"岗位波动较大需谨慎"）。如果用户意向行业就是 industryComparison 的某一条，userIndustry.industry 要与之完全一致，avgSalary 用同一个数字
4. 全部数字取整（8500, 12000, 15000 这类）
5. 不要写城市系数（后端合成）`;
}

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

    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请为"${formData.targetPosition}"应届校招岗位生成薪资 JSON。`;

    const partial = await callMiniMaxJson<{
      quartiles: SalaryInsight["quartiles"];
      industryComparison: SalaryInsight["industryComparison"];
      userIndustry?: SalaryInsight["userIndustry"];
    }>({
      systemPrompt: buildSystemPrompt(
        formData.targetPosition,
        formData.targetEducation,
        formData.resumeText
      ),
      userPrompt,
      maxTokens: 900,
      temperature: 0.5,
    });

    // Normalize: coerce salary strings to numbers, sort desc, take top 5
    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const industry = (partial.industryComparison || [])
      .map((row) => ({ industry: row.industry, avgSalary: toNum(row.avgSalary) }))
      .filter((row) => row.avgSalary > 0 && row.industry)
      .sort((a, b) => b.avgSalary - a.avgSalary)
      .slice(0, 5);

    const userIndustry = partial.userIndustry
      ? {
          industry: partial.userIndustry.industry,
          avgSalary: toNum(partial.userIndustry.avgSalary),
          note: partial.userIndustry.note,
        }
      : undefined;

    // Synthesize cityCoefficient on backend
    const cityCoefficient: SalaryInsight["cityCoefficient"] =
      cityCoefficients.map((c) => ({
        tier: c.tier,
        coefficient: c.coefficient,
        sampleCity: c.sampleCity,
        isUserTier: c.tier === formData.targetCityTier,
      }));

    const data: SalaryInsight = {
      quartiles: partial.quartiles,
      industryComparison: industry,
      userIndustry,
      cityCoefficient,
    };
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("salary section error:", error);
    const message = error instanceof Error ? error.message : "薪资章节生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
