import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  callMiniMaxJson,
  callIflytekJson,
} from "@/lib/report-shared";
import { hasIflytek } from "@/lib/iflytek";
import type { JobFormData, QuizQuestion } from "@/lib/types";
import {
  mergeQuizSkeleton,
  isMergedQuizComplete,
  type AiQuizResponse,
} from "@/lib/quiz-skeleton";

export const runtime = "nodejs";
export const maxDuration = 60;

// 骨架化版本：LLM 只出 question 文本和 options.{A,B,C,D} 文本；
// id / dimension / scoreMap 由服务端 mergeQuizSkeleton 合入。token 输出减半。
const QUIZ_SYSTEM_PROMPT = `你是一位资深校招心理测评设计师。为一名应届大学生设计 6 道职业性格快测题。

${APPLICANT_BASELINE}

6 题顺序固定：
- Q1：外倾 vs 内倾（E/I）
- Q2：感觉 vs 直觉（S/N）
- Q3：思考 vs 情感（T/F）
- Q4：判断 vs 知觉（J/P）
- Q5：风险偏好（稳定大厂 vs 快速增长创业）
- Q6：价值取向（薪资 / 兴趣 / 影响力 / 生活平衡）

要求：
1. 题目必须结合用户的意向岗位，措辞贴近应届场景（"实习中""小组作业里""校招投递时""秋招签约时"）
2. 每题 4 个选项（A/B/C/D），无对错，区分度要清晰
3. 选项文本 20-35 字为宜，不要堆砌修辞
4. **只输出题目文本和选项文本**——不要输出 id、dimension、score 等字段，这些由系统自动补齐

严格按下列 JSON 输出（不加 markdown 围栏，不加解释文字）：

{
  "questions": [
    {
      "question": "题目文本",
      "options": {
        "A": "选项文本",
        "B": "选项文本",
        "C": "选项文本",
        "D": "选项文本"
      }
    },
    ... 共 6 题 ...
  ]
}`;

const QUIZ_SYSTEM_PROMPT_FROM_Q2 = `你是一位资深校招心理测评设计师。为一名应届大学生设计 5 道职业性格快测题（第 2-6 题）。

${APPLICANT_BASELINE}

5 题顺序固定：
- Q2：感觉 vs 直觉（S/N）
- Q3：思考 vs 情感（T/F）
- Q4：判断 vs 知觉（J/P）
- Q5：风险偏好（稳定大厂 vs 快速增长创业）
- Q6：价值取向（薪资 / 兴趣 / 影响力 / 生活平衡）

要求：
1. 题目必须结合用户的意向岗位，措辞贴近应届场景（"实习中""小组作业里""校招投递时""秋招签约时"）
2. 每题 4 个选项（A/B/C/D），无对错，区分度要清晰
3. 选项文本 20-35 字为宜，不要堆砌修辞
4. **只输出题目文本和选项文本**——不要输出 id、dimension、score 等字段，这些由系统自动补齐

严格按下列 JSON 输出（不加 markdown 围栏，不加解释文字）：

{
  "questions": [
    {
      "question": "题目文本",
      "options": {
        "A": "选项文本",
        "B": "选项文本",
        "C": "选项文本",
        "D": "选项文本"
      }
    },
    ... 共 5 题 ...
  ]
}`;

function buildQuizUserPrompt(formData: JobFormData): string {
  // 静态指令前置，动态意向信息后置 —— 吃 MiniMax 自动前缀缓存（Part B）
  return [
    `请基于用户的意向岗位生成 6 道个性化快测题，题目要体现岗位的校招场景。按骨架 JSON 严格输出。`,
    ``,
    `应届生求职意向：`,
    `- 意向岗位：${formData.targetPosition}`,
    `- 意向学历：${formData.targetEducation}`,
    `- 意向公司/类型：${formData.targetCompany}`,
    `- 意向城市能级：${formData.targetCityTier}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formData = body?.formData as JobFormData | undefined;
    const from = body?.from === 2 ? 2 : 1;

    if (!formData?.targetPosition) {
      return NextResponse.json(
        { error: "缺少求职意向信息" },
        { status: 400 }
      );
    }

    const baseOpts = {
      systemPrompt: from === 2 ? QUIZ_SYSTEM_PROMPT_FROM_Q2 : QUIZ_SYSTEM_PROMPT,
      userPrompt: buildQuizUserPrompt(formData),
      temperature: 0.7,
      maxTokens: from === 2 ? 1900 : 2200,
    };

    // 讯飞主、MiniMax 兜底。讯飞经常 25s+，超时拉短让 fallback 提前介入：
    // 常态下 5-20s 返回；>25s 说明 slow path，快速切 MiniMax（~30s）总比 50s+30s 快
    let aiQuiz: AiQuizResponse;
    if (hasIflytek) {
      try {
        aiQuiz = await callIflytekJson<AiQuizResponse>({
          ...baseOpts,
          // 真机 5G 下讯飞 >25s 很常见；40s 给移动网络足够余量，仍比 50s 默认早
          timeoutMs: 40000,
        });
      } catch (iflytekErr) {
        console.warn(
          "iFlytek quiz generate failed, falling back to MiniMax:",
          iflytekErr
        );
        // MiniMax fallback 用默认 50s 超时（节省 token 模式下通常 20-35s）
        aiQuiz = await callMiniMaxJson<AiQuizResponse>(baseOpts);
      }
    } else {
      aiQuiz = await callMiniMaxJson<AiQuizResponse>(baseOpts);
    }

    // 服务端合并骨架：id / dimension / scoreMap 补齐
    const questions = mergeQuizSkeleton(aiQuiz, from === 2 ? 1 : 0);

    if (from === 2) {
      const complete =
        questions.length === 5 &&
        questions.every(
          (q) =>
            q.question.trim() &&
            q.options.length === 4 &&
            q.options.every((o) => o.label.trim().length > 0)
        );
      if (!complete) {
        console.warn("[quiz] from=2 merged quiz incomplete, using fallback");
        return NextResponse.json({ questions: getFallbackQuiz().slice(1) });
      }
      return NextResponse.json({ questions });
    }

    // AI 漏字段 → 降级静态题库，保证前端仍有题可做
    if (!isMergedQuizComplete(questions)) {
      console.warn("[quiz] merged quiz incomplete, falling back to static:", {
        returnedQuestions: aiQuiz?.questions?.length ?? 0,
      });
      return NextResponse.json({ questions: getFallbackQuiz() });
    }

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    console.error("Quiz generate API error:", error);
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ questions: getFallbackQuiz() });
    }
    const message = error instanceof Error ? error.message : "测评生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getFallbackQuiz(): QuizQuestion[] {
  return [
    {
      id: "q1",
      dimension: "E-I",
      question: "在实习期间的小组会议上，你更倾向于：",
      options: [
        { key: "A", label: "主动发言并引导讨论方向", score: { E: 2 } },
        { key: "B", label: "先认真记录，会后整理想法再反馈", score: { I: 2 } },
        { key: "C", label: "在擅长的话题上活跃，其它话题安静", score: { E: 1 } },
        { key: "D", label: "几乎只在被点名时才开口", score: { I: 1 } },
      ],
    },
    {
      id: "q2",
      dimension: "S-N",
      question: "评估一个新产品方案时，你更关注：",
      options: [
        { key: "A", label: "已有的数据和真实用户反馈", score: { S: 2 } },
        { key: "B", label: "未来的趋势和潜在可能性", score: { N: 2 } },
        { key: "C", label: "当下能否落地执行", score: { S: 1 } },
        { key: "D", label: "是否符合长期战略", score: { N: 1 } },
      ],
    },
    {
      id: "q3",
      dimension: "T-F",
      question: "小组作业里出现意见分歧时，你更愿意：",
      options: [
        { key: "A", label: "用逻辑和数据据理力争", score: { T: 2 } },
        { key: "B", label: "先照顾每个人的感受再谈方案", score: { F: 2 } },
        { key: "C", label: "直接拍板推进，效率优先", score: { T: 1 } },
        { key: "D", label: "寻找折衷，让大家都能接受", score: { F: 1 } },
      ],
    },
    {
      id: "q4",
      dimension: "J-P",
      question: "面对校招投递季，你通常的节奏是：",
      options: [
        { key: "A", label: "提前 3 个月列好清单，按计划推进", score: { J: 2 } },
        { key: "B", label: "随机应变，遇到机会就投", score: { P: 2 } },
        { key: "C", label: "设定大目标，过程灵活调整", score: { J: 1 } },
        { key: "D", label: "临近截止才集中发力", score: { P: 1 } },
      ],
    },
    {
      id: "q5",
      dimension: "risk",
      question: "同时拿到两份 offer，你会怎么选：",
      options: [
        { key: "A", label: "成熟大厂，培养体系完整、薪资稳定", score: { stable: 2 } },
        { key: "B", label: "高速成长的初创，空间大但节奏快", score: { growth: 2 } },
        { key: "C", label: "看行业头部，其他都可以考虑", score: { stable: 1 } },
        { key: "D", label: "看直属 leader 和团队氛围", score: { growth: 1 } },
      ],
    },
    {
      id: "q6",
      dimension: "value",
      question: "对你而言，第一份工作最重要的是：",
      options: [
        { key: "A", label: "薪资和福利", score: { salary: 2 } },
        { key: "B", label: "做感兴趣的事", score: { interest: 2 } },
        { key: "C", label: "在好的平台带来行业影响力", score: { impact: 2 } },
        { key: "D", label: "工作和生活保持平衡", score: { balance: 2 } },
      ],
    },
  ];
}
