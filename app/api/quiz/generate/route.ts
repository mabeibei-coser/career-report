import { NextRequest, NextResponse } from "next/server";
import {
  APPLICANT_BASELINE,
  callMiniMaxJson,
} from "@/lib/report-shared";
import type { JobFormData, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUIZ_SYSTEM_PROMPT = `你是一位资深校招心理测评设计师。请为一名应届大学生设计 6 道职业性格 + 职业选择快测题。

${APPLICANT_BASELINE}

要求：
1. 题目必须结合用户的意向岗位，措辞贴近应届生语境（如"实习中""小组作业里""校招投递时"）
2. 每道题覆盖一个维度，顺序固定：
   - Q1 dimension="E-I" 外倾/内倾
   - Q2 dimension="S-N" 感觉/直觉
   - Q3 dimension="T-F" 思考/情感
   - Q4 dimension="J-P" 判断/知觉
   - Q5 dimension="risk" 风险偏好（稳定大厂 vs 快速增长创业）
   - Q6 dimension="value" 价值取向（薪资/兴趣/影响力/生活平衡）
3. 每题 4 个选项（A/B/C/D），无对错，区分度要清晰
4. score 字段按维度给分：例如 E-I 维度下，偏 E 的选项 score: {E: 2}，偏 I 的选项 score: {I: 2}；value 维度选项应标记 {salary:2} / {interest:2} / {impact:2} / {balance:2} 之一

严格按下列 JSON 输出（不要额外文字和 markdown 围栏）：

{
  "questions": [
    {
      "id": "q1",
      "dimension": "E-I",
      "question": "题目文本",
      "options": [
        {"key":"A","label":"选项文本","score":{"E":2}},
        {"key":"B","label":"选项文本","score":{"I":2}},
        {"key":"C","label":"选项文本","score":{"E":1}},
        {"key":"D","label":"选项文本","score":{"I":1}}
      ]
    }
  ]
}`;

function buildQuizUserPrompt(formData: JobFormData): string {
  return [
    `应届生求职意向：`,
    `- 意向岗位：${formData.targetPosition}`,
    `- 意向学历：${formData.targetEducation}`,
    `- 意向公司/类型：${formData.targetCompany}`,
    `- 意向城市能级：${formData.targetCityTier}`,
    ``,
    `请基于该意向生成 6 道个性化快测题，题目要体现"${formData.targetPosition}"的校招场景。输出严格 JSON。`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formData = body?.formData as JobFormData | undefined;

    if (!formData?.targetPosition) {
      return NextResponse.json(
        { error: "缺少求职意向信息" },
        { status: 400 }
      );
    }

    const data = await callMiniMaxJson<{ questions: QuizQuestion[] }>({
      systemPrompt: QUIZ_SYSTEM_PROMPT,
      userPrompt: buildQuizUserPrompt(formData),
      temperature: 0.7,
      maxTokens: 3500,
    });

    if (!data?.questions || data.questions.length < 6) {
      throw new Error("AI 返回的测评题不完整");
    }

    // Ensure IDs exist and are stable
    const questions = data.questions.slice(0, 6).map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
    }));

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
