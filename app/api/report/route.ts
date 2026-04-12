import { NextRequest, NextResponse } from "next/server";
import client, { MINIMAX_MODEL } from "@/lib/minimax";
import type { JobFormData, ReportData, ResumeData } from "@/lib/types";

const REPORT_SYSTEM_PROMPT = `你是一位资深的职业分析专家。请根据来访者的基本信息和访谈内容，生成一份结构化的职业定位分析报告。

请严格按照以下 JSON 格式输出，不要添加任何额外文字或 markdown 标记：

{
  "summary": "一段200字左右的职业定位总述",
  "jobOverview": {
    "positioning": "岗位定位描述",
    "responsibilities": [
      {"name": "职责名称", "description": "职责描述", "weight": 权重百分比数字}
    ],
    "roleType": "岗位类型",
    "levelRequirements": "职级要求描述"
  },
  "industryAnalysis": {
    "trend": "行业趋势描述",
    "demandChange": "需求变化描述",
    "competition": "竞争情况描述",
    "insights": [
      {"title": "洞察标题", "content": "洞察内容"}
    ]
  },
  "competencyProfile": {
    "dimensions": [
      {"name": "能力维度名称", "score": 分数1-100, "description": "描述", "isCore": true/false}
    ],
    "highPerformerTraits": ["特征1", "特征2", "特征3"]
  },
  "developmentPath": {
    "currentStage": "当前阶段描述",
    "upwardPaths": [
      {"title": "晋升方向", "description": "描述", "requiredSkills": ["技能1", "技能2"]}
    ],
    "lateralPaths": [
      {"title": "横向发展方向", "description": "描述"}
    ],
    "shortTermAdvice": ["短期建议1", "短期建议2"],
    "midTermAdvice": ["中期建议1", "中期建议2"]
  },
  "personalizedAdvice": {
    "items": [
      {"title": "建议标题", "content": "建议内容"}
    ]
  },
  "supplementary": {
    "benchmarkRoles": ["对标岗位1", "对标岗位2"],
    "salaryRange": {"low": 最低月薪数字, "median": 中位数月薪, "high": 最高月薪, "unit": "元/月"},
    "sources": ["数据来源说明"],
    "disclaimer": "免责声明"
  }
}

要求：
1. competencyProfile.dimensions 必须恰好有 5 个维度（用于雷达图），分数范围 1-100
2. responsibilities 需要 3-5 个，weight 总和为 100
3. insights 需要 2-3 个
4. upwardPaths 需要 2-3 个，lateralPaths 需要 1-2 个
5. personalizedAdvice.items 需要 3-4 个
6. 内容要专业、具体、有建设性
7. salaryRange 根据岗位、行业、城市给出合理估计
8. 如果提供了简历原文，额外生成 resumeSuggestions 字段（见下方说明）`;

const RESUME_SUGGESTIONS_ADDENDUM = `

由于来访者上传了简历，请在报告 JSON 中额外包含以下字段：
"resumeSuggestions": {
  "items": [
    {"title": "建议标题", "problem": "发现的问题", "suggestion": "改进建议"}
  ]
}
要求：给出 3 条简历优化建议，针对简历内容的结构、表述、关键信息缺失等方面给出具体可操作的改进建议。`;

function buildReportPrompt(
  formData: JobFormData,
  messages: { role: string; content: string }[],
  resumeData?: ResumeData
): string {
  let prompt = `来访者基本信息：
- 岗位名称：${formData.positionName}
- 所属行业：${formData.industry}
- 企业性质：${formData.companyType}
- 城市等级：${formData.cityLevel}
- 匹配职级：${formData.jobLevel}
- 工作年限：${formData.workYears}

`;

  if (resumeData) {
    prompt += `简历背景信息：\n`;
    if (resumeData.extraInfo?.schoolName) {
      prompt += `- 毕业学校：${resumeData.extraInfo.schoolName}\n`;
    }
    if (resumeData.extraInfo?.skills?.length) {
      prompt += `- 核心技能：${resumeData.extraInfo.skills.join("、")}\n`;
    }
    if (resumeData.extraInfo?.workHistory) {
      prompt += `- 工作经历：${resumeData.extraInfo.workHistory}\n`;
    }
    // Include truncated raw text for resume suggestions
    const resumeText = resumeData.rawText?.slice(0, 4000);
    if (resumeText) {
      prompt += `\n简历原文（用于生成简历优化建议）：\n${resumeText}\n`;
    }
    prompt += "\n";
  }

  if (messages && messages.length > 0) {
    prompt += "访谈记录：\n";
    for (const msg of messages) {
      const role = msg.role === "ai" ? "咨询师" : "来访者";
      prompt += `${role}：${msg.content}\n`;
    }
    prompt += "\n";
  }

  prompt += "请根据以上信息生成完整的职业定位分析报告（JSON格式）。";
  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData, messages, resumeData } = body as {
      formData: JobFormData;
      messages: { role: string; content: string }[];
      resumeData?: ResumeData;
    };

    if (!formData || !formData.positionName) {
      return NextResponse.json(
        { error: "缺少来访者基本信息" },
        { status: 400 }
      );
    }

    const userPrompt = buildReportPrompt(formData, messages, resumeData);
    const systemPrompt = resumeData
      ? REPORT_SYSTEM_PROMPT + RESUME_SUGGESTIONS_ADDENDUM
      : REPORT_SYSTEM_PROMPT;

    const response = await client.chat.completions.create({
      model: MINIMAX_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 8000,
    });

    const rawContent = response.choices[0]?.message?.content || "";
    // Strip <think>...</think> blocks from reasoning models
    const content = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Extract JSON from response (handle possible markdown wrapping)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to fix truncated JSON by closing brackets
    let reportBody;
    try {
      reportBody = JSON.parse(jsonStr.trim());
    } catch {
      // Attempt to fix incomplete JSON
      let fixed = jsonStr.trim();
      // Close any unclosed strings
      const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) fixed += '"';
      // Close brackets/braces
      const opens = (fixed.match(/[{[]/g) || []).length;
      const closes = (fixed.match(/[}\]]/g) || []).length;
      for (let i = 0; i < opens - closes; i++) {
        // Determine if we need ] or }
        const lastOpen = fixed.lastIndexOf("{") > fixed.lastIndexOf("[") ? "}" : "]";
        fixed += lastOpen;
      }
      reportBody = JSON.parse(fixed);
    }

    // Assemble full report
    const report: ReportData = {
      meta: {
        generatedAt: new Date().toISOString(),
        formData,
        interviewSummary:
          messages && messages.length > 0
            ? `共进行了${Math.ceil(messages.length / 2)}轮访谈对话`
            : "未进行访谈",
      },
      ...reportBody,
    };

    return NextResponse.json(report);
  } catch (error: unknown) {
    console.error("Report API error:", error);

    // Return mock data if AI fails, so the frontend can still render
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(getMockReport());
    }

    const message =
      error instanceof Error ? error.message : "报告生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getMockReport(): ReportData {
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      formData: {
        positionName: "产品经理",
        industry: "互联网/IT",
        companyType: "民营企业",
        cityLevel: "一线城市",
        jobLevel: "经理/工程师",
        workYears: "3-5年",
      },
      interviewSummary: "共进行了3轮访谈对话",
    },
    summary:
      "根据综合分析，您当前处于产品经理职业发展的成长期，具备扎实的需求分析和项目管理能力。在互联网行业快速迭代的大背景下，建议重点提升数据驱动决策能力和商业思维，向高级产品经理或产品总监方向发展。您在用户洞察和跨部门沟通方面表现突出，这是未来晋升的核心竞争力。",
    jobOverview: {
      positioning: "中级产品经理，负责核心业务线的产品规划与迭代",
      responsibilities: [
        { name: "需求管理", description: "收集、分析、优先级排序用户需求和业务需求", weight: 30 },
        { name: "产品设计", description: "输出产品方案、原型设计、PRD文档", weight: 25 },
        { name: "项目推进", description: "协调研发、设计、测试团队推进产品上线", weight: 20 },
        { name: "数据分析", description: "通过数据分析评估产品效果，持续优化", weight: 15 },
        { name: "战略规划", description: "参与产品路线图和年度规划", weight: 10 },
      ],
      roleType: "产品管理",
      levelRequirements: "需要3年以上互联网产品经验，熟悉敏捷开发流程",
    },
    industryAnalysis: {
      trend: "互联网行业正在从增量市场转向存量市场，AI技术正在重塑产品形态",
      demandChange: "企业对产品经理的要求从功能型转向策略型，数据和AI能力成为加分项",
      competition: "一线城市产品经理竞争激烈，但优质候选人仍然稀缺",
      insights: [
        { title: "AI赋能产品", content: "掌握AI产品设计方法论将成为未来3年的核心竞争力" },
        { title: "出海机会", content: "跨境和海外市场为产品经理提供了新的发展空间" },
        { title: "垂直深耕", content: "在特定行业深耕的产品经理比通用型更受青睐" },
      ],
    },
    competencyProfile: {
      dimensions: [
        { name: "用户洞察", score: 82, description: "深入理解用户需求和痛点的能力", isCore: true },
        { name: "数据分析", score: 68, description: "通过数据驱动产品决策的能力", isCore: false },
        { name: "项目管理", score: 75, description: "跨团队协调和推进项目的能力", isCore: true },
        { name: "商业思维", score: 60, description: "从商业角度评估产品价值的能力", isCore: false },
        { name: "技术理解", score: 72, description: "理解技术实现和架构的能力", isCore: false },
      ],
      highPerformerTraits: ["强烈的用户同理心", "数据敏感度高", "优秀的跨部门沟通能力"],
    },
    developmentPath: {
      currentStage: "职业成长期（3-5年经验），正处于从执行层向管理层过渡的关键阶段",
      upwardPaths: [
        {
          title: "高级产品经理",
          description: "负责更大业务线的产品策略和团队管理",
          requiredSkills: ["产品战略规划", "团队管理", "商业分析"],
        },
        {
          title: "产品总监",
          description: "统筹多条产品线，参与公司战略决策",
          requiredSkills: ["战略思维", "P&L管理", "组织能力"],
        },
      ],
      lateralPaths: [
        { title: "创业/合伙人", description: "利用产品能力和行业认知进行创业" },
        { title: "咨询顾问", description: "转型为产品咨询或数字化转型顾问" },
      ],
      shortTermAdvice: [
        "系统学习数据分析工具和方法论（SQL、A/B测试等）",
        "主动承担跨部门协作的大型项目",
      ],
      midTermAdvice: [
        "培养商业敏感度，学习财务和运营知识",
        "建立行业人脉，参与行业会议和社群",
      ],
    },
    personalizedAdvice: {
      items: [
        { title: "提升数据能力", content: "建议每周至少花2小时学习SQL和数据分析，3个月内能独立完成产品数据看板搭建" },
        { title: "建立方法论体系", content: "将日常工作中的最佳实践整理成文档，形成可复用的产品方法论" },
        { title: "拓展视野", content: "每月阅读一本商业或行业书籍，关注竞品和行业动态" },
        { title: "积累管理经验", content: "主动带领实习生或初级产品经理，培养团队管理能力" },
      ],
    },
    supplementary: {
      benchmarkRoles: ["高级产品经理", "产品负责人", "产品总监"],
      salaryRange: { low: 18000, median: 25000, high: 40000, unit: "元/月" },
      sources: ["行业调研数据", "招聘平台公开数据", "AI模型分析"],
      disclaimer: "本报告基于AI分析生成，仅供职业咨询参考，不构成任何就业或投资建议。实际情况可能因个人经历、市场变化等因素有所不同。",
    },
  };
}
