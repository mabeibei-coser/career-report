import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callWithFallback,
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
3. userIndustry 的 industry 字段**必须直接使用上下文里"系统推断行业"的值**，不要再基于公司名字面重新推断（例如上下文推断行业是"金融/银行"，哪怕公司名含"建设"二字也写"金融/银行"，不要写"建筑"）。avgSalary 给该行业应届水平、note 一句 15-30 字的定位话（例"高于行业中位约 XX%"、"稀缺但稳定"、"岗位波动较大需谨慎"）。若 industryComparison 里已有同名条目，avgSalary 必须与之一致
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

    // 静态指令前置，buildBaseContext 的动态内容后置 —— 吃 MiniMax 自动前缀缓存
    const userPrompt = `请为用户的意向岗位生成应届校招薪资 JSON（包含 quartiles、industryComparison、userIndustry）。\n\n${buildBaseContext(formData, quizAnswers)}`;

    const callOpts = {
      systemPrompt: buildSystemPrompt(
        formData.targetPosition,
        formData.targetEducation,
        formData.resumeText
      ),
      userPrompt,
      maxTokens: 1400,
      temperature: 0.5,
    };

    type PartialSalary = {
      quartiles: SalaryInsight["quartiles"];
      industryComparison: SalaryInsight["industryComparison"];
      userIndustry?: SalaryInsight["userIndustry"];
    };

    const partial = await callWithFallback<PartialSalary>(callOpts);

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
