import { NextRequest, NextResponse } from "next/server";
import client, { MINIMAX_MODEL } from "@/lib/minimax";
import { detectFileType, extractText } from "@/lib/resume-parser";
import { industries, companyTypes, cityLevels, jobLevels, workYears } from "@/lib/form-options";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_FOR_AI = 8000; // 发送给 AI 的最大字符数

const EXTRACTION_PROMPT = `你是一个简历信息提取助手。请从以下简历文本中提取结构化信息。

## 需要提取的字段

1. positionName - 最近一份工作的岗位名称（原文，如"高级产品经理"）
2. industry - 所属行业，必须从以下选项中选择一个最匹配的：
   [${industries.join(", ")}]
3. companyType - 企业性质，必须从以下选项中选择：
   [${companyTypes.join(", ")}]
4. cityLevel - 城市等级，根据工作城市推断，从以下选项选择：
   [${cityLevels.join(", ")}]
5. jobLevel - 匹配职级，根据岗位头衔和工作年限推断，从以下选项选择：
   [${jobLevels.join(", ")}]
6. workYears - 工作年限，根据最早工作时间计算到现在，从以下选项选择：
   [${workYears.join(", ")}]
7. schoolName - 最高学历的毕业学校名称
8. skills - 核心技能关键词列表（3-8个）
9. workHistory - 工作经历概述（2-3句话）

## 返回格式

严格返回 JSON，不要添加任何额外文字：
{
  "positionName": "...",
  "industry": "...",
  "companyType": "...",
  "cityLevel": "...",
  "jobLevel": "...",
  "workYears": "...",
  "schoolName": "...",
  "skills": ["...", "..."],
  "workHistory": "..."
}

对于无法确定的字段，返回 null。industry/companyType/cityLevel/jobLevel/workYears 必须精确匹配给定的选项值，不要自创。`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    const fileType = detectFileType(file.name, file.type);
    if (!fileType) {
      return NextResponse.json(
        { error: "不支持的文件格式，请上传 PDF、DOCX 或 DOC 文件" },
        { status: 400 }
      );
    }

    // 提取文本
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText: string;
    try {
      rawText = await extractText(buffer, fileType);
    } catch (parseErr) {
      console.error("Resume text extraction error:", parseErr);
      return NextResponse.json(
        { error: "文件解析失败，请确认文件内容完整且未加密" },
        { status: 400 }
      );
    }

    if (!rawText || rawText.length < 20) {
      return NextResponse.json(
        { error: "未能从文件中提取到有效文本，请检查文件内容" },
        { status: 400 }
      );
    }

    // AI 结构化提取
    const textForAI = rawText.slice(0, MAX_TEXT_FOR_AI);

    const completion = await client.chat.completions.create({
      model: MINIMAX_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `简历内容：\n${textForAI}` },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content || "";

    // 解析 AI 返回的 JSON
    let parsed;
    try {
      // 清理可能的 markdown 包裹
      const jsonStr = aiResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch (jsonErr) {
      console.error("AI response JSON parse failed:", jsonErr);
      console.error("Raw AI response:", aiResponse.slice(0, 1000));
      return NextResponse.json(
        { error: "AI 解析结果异常，请重试" },
        { status: 500 }
      );
    }

    // 构建响应：分离表单字段和额外信息
    const extractedFields: Record<string, string | null> = {};
    for (const key of ["positionName", "industry", "companyType", "cityLevel", "jobLevel", "workYears"]) {
      extractedFields[key] = parsed[key] || null;
    }

    // 验证选项字段是否匹配预定义值
    const optionValidation: Record<string, string[]> = {
      industry: industries,
      companyType: companyTypes,
      cityLevel: cityLevels,
      jobLevel: jobLevels,
      workYears: workYears,
    };

    for (const [key, options] of Object.entries(optionValidation)) {
      const value = extractedFields[key];
      if (value && !options.includes(value)) {
        // AI 返回了不匹配的值，尝试模糊匹配
        const match = options.find(
          (opt) => opt.includes(value) || value.includes(opt)
        );
        extractedFields[key] = match || null;
      }
    }

    return NextResponse.json({
      extractedFields,
      extraInfo: {
        schoolName: parsed.schoolName || null,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        workHistory: parsed.workHistory || null,
      },
      rawText: rawText.slice(0, 20000), // 截断存储
    });
  } catch (error) {
    console.error("Resume parse error:", error);
    return NextResponse.json(
      { error: "简历解析服务异常，请稍后重试" },
      { status: 500 }
    );
  }
}
