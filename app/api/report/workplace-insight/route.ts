import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, QuizAnswer, WorkplaceInsight } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是校招市场观察员，输出"职场环境透视"章节。

${APPLICANT_BASELINE}

**写作铁律**（违反即失败）：
- 禁止"整体而言""总体来看""可以说""值得注意的是"类套话
- 禁止形容词堆砌和宣传口号感
- observations 要**像把脉脉 / 小红书 / 知乎 / 贴吧的真实帖子改写成第三人称复述**，保留网友原帖的具体性：职级命名（P4/P5/P6、T3/T4）、比例数字、具体动作、具体吐槽点
- 关于意向公司的 observations **可以直接出现用户填入的公司名**，并把它当作"这家公司"来陈述事实
- 但**严禁杜撰**以下内容（造成诽谤风险）：
  * 具体员工姓名 / 未公开的内部薪资数字 / 未经验证的具体事件
  * 任何违法犯罪 / 行业垄断定性的指控
  * 没有来源依据的负面事实断言
- observations 必须**归因到公开平台**（"据脉脉/小红书/知乎上的反馈…"、"JD 里反复出现…"），明确信息是公开网络整理，不是报告立场
- attentions 必须动词开头、动作具体（例"签约前追问 Level 和直属 leader 姓名"），不写"注意 XXX"这种空话

章节 3 部分：

1. industryAdvice（行业）
   - summary：80-140 字，讲这个行业对应届生当下的趋势和价值判断。信息密度要高、具体到 2-3 个可观察信号（数字、岗位名、趋势方向、政策或市场变化），不要用"toB 稳定""AI 扩张"这类 4-6 字短语拼凑，而是写成完整句子

2. companyInsight（对用户意向公司的具体观察）
   - targetLabel：**原样回显**用户填写的意向公司名，不改写
   - developmentSummary：80-150 字，聚焦该公司**近 12 个月**的发展现状 —— 市场地位、近期业务动向（扩张 / 收缩 / 新业务 / 融资 / 组织调整）、对应届生的用人偏好变化。必须**归因公开来源**（"据 2024-2025 年公开财报 / 媒体报道 / 招聘 JD 动态…"），**禁止杜撰未公开数据**，**禁止负面事实断言**，不要和下方 observations 重复（developmentSummary 讲公司"当下状态"，observations 讲网友"怎么说"）
   - summary：50-90 字，简洁说明后面的 observations 基于哪些公开渠道和时间范围（例"综合 2024-2025 年脉脉 / 小红书 / 知乎 / 校招贴吧上关于 XXX 的公开反馈"）
   - observations：3-4 条
     * source：来源标签（要有差异，如"脉脉近一年吐槽"、"小红书校招笔记"、"知乎校招话题"、"校招贴吧反馈"、"官方 JD 反复出现"）
     * voice：80-150 字的单一观察，针对**用户填入的那家公司**来写。内容含具体可验证的细节（职级 / 比例 / 薪资区间 / 团队风格 / 加班强度等），**归因公开网络**，不夸大不造谣
   - attentions：恰好 2-3 条签约前要做的动作，**每条 25-50 字**，动词开头，针对**该家公司**最值得问 / 查 / 对比的点，具体到追问哪个字段 / 查哪个平台 / 对比什么

3. synthesis：80-120 字，把前面内容收束成「应届生对这家公司该怎么做决策」——要具体，不泛化

严格输出 JSON，不加任何额外文字：

{
  "industryAdvice": { "summary": "..." },
  "companyInsight": {
    "targetLabel": "...",
    "developmentSummary": "...",
    "summary": "...",
    "observations": [{"source": "...", "voice": "..."}],
    "attentions": ["..."]
  },
  "synthesis": "..."
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
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n用户意向公司：「${formData.targetCompany}」\n请基于公开网络对这家公司的反馈（脉脉/小红书/知乎/校招贴吧），给出 companyInsight.observations；targetLabel 必须原样回显"${formData.targetCompany}"。`;
    const data = await callMiniMaxJson<WorkplaceInsight>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.55,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("workplace-insight section error:", error);
    const message =
      error instanceof Error ? error.message : "职场环境透视生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
