import { NextRequest, NextResponse } from "next/server";
import client, { MINIMAX_MODEL } from "@/lib/minimax";
import type { JobFormData } from "@/lib/types";

const SYSTEM_PROMPT = `你是一位资深的职业咨询顾问，正在社保局为来访者进行职业定位访谈。

你的任务：
1. 根据来访者的基本信息，逐轮提出有针对性的问题
2. 每次只问一个问题，语气亲切专业
3. 总共进行 3-5 轮对话，覆盖以下方向：
   - 第1轮：当前工作内容与核心职责
   - 第2轮：个人核心能力与优势
   - 第3轮：职业发展困惑或瓶颈
   - 第4轮（可选）：期望的职业发展方向
   - 第5轮（可选）：对所在行业趋势的看法
4. 根据来访者的回答灵活调整后续问题
5. 当获得足够信息后（至少3轮），在回复中包含 [访谈结束] 标记

回复格式：直接输出问题内容，不要加编号或前缀。
如果访谈应该结束，在问题后另起一行加上 [访谈结束]。`;

function buildUserContext(formData: JobFormData): string {
  return `来访者基本信息：
- 岗位名称：${formData.positionName}
- 所属行业：${formData.industry}
- 企业性质：${formData.companyType}
- 城市等级：${formData.cityLevel}
- 匹配职级：${formData.jobLevel}
- 工作年限：${formData.workYears}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData, messages } = body as {
      formData: JobFormData;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!formData || !formData.positionName) {
      return NextResponse.json(
        { error: "缺少来访者基本信息" },
        { status: 400 }
      );
    }

    const userContext = buildUserContext(formData);

    // Build conversation for the AI
    const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContext },
    ];

    // If no prior messages, this is the first question
    if (!messages || messages.length === 0) {
      apiMessages.push({
        role: "user",
        content: "请根据我的基本信息，开始第一轮访谈提问。",
      });
    } else {
      // Add conversation history
      for (const msg of messages) {
        apiMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const response = await client.chat.completions.create({
      model: MINIMAX_MODEL,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const rawContent = response.choices[0]?.message?.content || "";
    // Strip <think>...</think> blocks from reasoning models
    const content = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const isComplete = content.includes("[访谈结束]");
    const cleanContent = content.replace("[访谈结束]", "").trim();

    return NextResponse.json({
      message: cleanContent,
      isComplete,
    });
  } catch (error: unknown) {
    console.error("Interview API error:", error);
    const message =
      error instanceof Error ? error.message : "AI 服务暂时不可用";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
