import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, Overview, QuizAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---- 内容校验：拦截 AI 吐合法 JSON 但字段是占位符/空串的情况 ----
// 命中则抛错 → 外层 report-client.ts 的重试机制触发 → 仍失败 fallback 到 overviewMock
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\.{2,}$/,          // "..."、".."
  /^<[^>]*>$/,         // "<字段描述>"、"<请填>"
  /^x{2,}$/i,          // "xxx"、"XX"
  /^示例/,              // "示例..."
  /^请填/,              // "请填..."
  /^\d+\s*-\s*\d+\s*字/, // "40-60 字"、"2-4 字"（schema 描述被原样输出）
];

function isBadString(s: unknown, minLen = 2): boolean {
  if (typeof s !== "string") return true;
  const t = s.trim();
  if (t.length < minLen) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

function validateOverview(d: Overview): string | null {
  if (!d || typeof d !== "object") return "overview 根对象缺失";
  if (isBadString(d.positioning, 10)) return "positioning 缺失/占位符";
  if (isBadString(d.summary, 10)) return "summary 缺失/占位符";
  if (
    !d.strength ||
    isBadString(d.strength.title) ||
    isBadString(d.strength.detail, 15)
  )
    return "strength 缺失";
  if (
    !d.improvement ||
    isBadString(d.improvement.title) ||
    isBadString(d.improvement.detail, 15)
  )
    return "improvement 缺失";
  if (!d.personality || isBadString(d.personality.type))
    return "personality.type 缺失";
  if (
    !Array.isArray(d.personality.traits) ||
    d.personality.traits.length === 0
  )
    return "personality.traits 缺失";
  if (isBadString(d.personality.description, 30))
    return "personality.description 缺失";
  return null;
}

const SYSTEM_PROMPT = `你是校招定位分析师，输出"总览"章节 JSON。

${APPLICANT_BASELINE}

**铁律**：客观分析语气，不写鸡汤。禁止"整体而言/总体来看/可以说/应该说/是一位…的候选人"，禁止形容词堆砌（突出/坚实/强劲/亮眼），禁止"未来可期/潜力大"类空话。

字段要求：

1. positioning（40-70 字）：一句核心定位判断，必须含至少 2 个具体信号（擅长 X + 卡在 Y）。示例："B 端 PM 方向的结构化共情型候选人——擅长把业务诉求翻译成 PRD，但缺商业量化和数据分析历练。"
2. summary：2-3 短句，分别讲定位、优势、最大短板。
3. strength：{title: 2-4 字凝练, detail: 40-60 字说这点在校招哪种场合变筹码}
4. improvement：{title: 2-4 字, detail: 40-60 字，问题 + 可执行动作（数字+频率）}
5. personality（基于 6 题测评）：
   - type：MBTI 四字母 + 4-6 字中文定位，如 "ENFJ · 温和型推动者"
   - traits：3-4 个 2-4 字中文标签
   - description（80-120 字）：这种性格在校招场景的实际表现——最受欢迎的场合 + 最容易掉坑的场合，白描不鸡汤`;

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
    const issue = validateOverview(data);
    if (issue) {
      console.warn("[overview] 内容校验失败，触发重试:", issue, { data });
      throw new Error(`overview 内容校验失败: ${issue}`);
    }
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("overview section error:", error);
    const message = error instanceof Error ? error.message : "总览章节生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
