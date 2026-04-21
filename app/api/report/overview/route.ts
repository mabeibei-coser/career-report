import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, Overview, QuizAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是一位资深校招定位分析师，正在为一名应届大学生写职业定位报告的"总览"章节。

${APPLICANT_BASELINE}

**重要：这是一份给学生的「报告」而不是「杂志」，语气要像一份客观分析，而不是鸡汤或公众号。严禁以下句式：**
- "整体而言" / "总体来看" / "可以说" / "应该说"
- "是一位…的候选人" / "在…中处在…位置"
- "能在…的话，…会相对顺利" 这类条件+期待的句式
- 任何形容词堆砌（"突出"、"坚实"、"强劲"、"亮眼"）
- 任何让学生"放心"或"加油"的 AI 鸡汤

产出结构：

1. positioning：40-70 字的一段**有信息量**的定位判断，作为这份报告最核心的一句判断。格式要求：
   - **必须含至少 2 个具体信号**（"擅长 X + 卡在 Y"、"有 A 优势 + 缺 B 历练"），不能只给模糊评级
   - **禁止**"综合素质中上 / 基础扎实 / 整体不错"这类没信息量的空泛断言
   - **禁止**纯鸡汤（"未来可期 / 潜力大"）
   - 好的示例：
     * "B 端 PM 方向的结构化共情型候选人——擅长把业务诉求翻译成 PRD，但缺商业量化和数据分析历练，离亮眼候选人还有一段距离。"
     * "C 端产品方向的入门期选手——对用户的敏感度已到位，但缺 SQL 和增长实操，目前更接近合格校招新人。"
     * "技术方向的科研型选手——算法思维和理论扎实，但项目上线 / 工程化经历不足，需要一段真实业务实习补齐。"
   - 直接下结论 + 两个信号支撑，不铺垫、不解释
2. summary：2-3 短句，每句讲一件事：定位、优势所在、最大短板。冗词少于 10%，句子短促。
3. strength：一条最核心优势
   - title：2-4 字凝练（例"结构化共情"）
   - detail：40-60 字，直接说这点**在校招的哪种场合**变成筹码
4. improvement：一条最值得补的短板
   - title：2-4 字凝练
   - detail：40-60 字，直接指出问题 + 一个可执行动作（数字 + 频率）
5. personality：基于 6 题性格测评结果给出一个**职业性格画像**
   - type：凝练 label，形如 "ENFJ · 温和型推动者"、"ISTJ · 细节守门员"、"ENTP · 挑战型创意者"（MBTI 四字母 + 一个 4-6 字中文定位）
   - traits：3-4 个 2-4 字中文标签，例 "共情力强"、"结构化"、"偶尔犹豫"
   - description：80-120 字，用白描陈述这种性格**在校招场景下的实际表现**——最受欢迎的场合 + 最容易掉坑的场合。**不要鸡汤**，不要"非常棒"/"很优秀"类形容词。

严格输出以下 JSON：

{
  "positioning": "...",
  "summary": "...",
  "strength": { "title": "...", "detail": "..." },
  "improvement": { "title": "...", "detail": "..." },
  "personality": {
    "type": "...",
    "traits": ["...", "...", "..."],
    "description": "..."
  }
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
    const userPrompt = `${buildBaseContext(formData, quizAnswers)}\n\n请严格按约定 JSON 输出"总览"章节。`;
    const data = await callMiniMaxJson<Overview>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.6,
    });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("overview section error:", error);
    const message = error instanceof Error ? error.message : "总览章节生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
