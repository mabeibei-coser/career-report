import client, { MINIMAX_MODEL } from "@/lib/minimax";
import type { JobFormData, QuizAnswer } from "@/lib/types";

export const APPLICANT_BASELINE = `用户是应届大学生（校招场景），无正式工作经验（可能有实习）。所有分析均以应届生的视角展开：
- 薪资严格对标校招起薪（非社招）；一线中位 8-10K，新一线 6-8K，二线 5-6K，三线 4K 左右是常见区间，避免给出明显高于真实应届水平的虚高数字
- 简历以教育背景 + 实习 + 校园项目 + 技能为主
- 语气亲和，像校招指导老师；避免"多年工作"、"团队管理"等社招语境
- 所有内容务必紧扣校招语境，不要泛化`;

export function buildBaseContext(
  formData: JobFormData,
  quizAnswers?: QuizAnswer[]
): string {
  const parts = [
    "求职意向信息：",
    `- 意向岗位：${formData.targetPosition}`,
    `- 意向学历：${formData.targetEducation}`,
    `- 意向公司/类型：${formData.targetCompany}`,
    `- 意向城市能级：${formData.targetCityTier}`,
  ];

  if (quizAnswers && quizAnswers.length > 0) {
    parts.push("\n6 题职业性格测评结果：");
    for (const ans of quizAnswers) {
      parts.push(
        `- [${ans.dimension}] ${ans.questionText} → 选择 ${ans.selectedKey}: ${ans.selectedLabel}`
      );
    }
  }

  if (formData.resumeText) {
    const snippet =
      formData.resumeText.length > 4000
        ? formData.resumeText.slice(0, 4000) + "\n...(已截断)"
        : formData.resumeText;
    parts.push("\n简历内容：\n" + snippet);
  } else {
    parts.push("\n简历内容：未上传");
  }

  return parts.join("\n");
}

export function stripReasoning(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = content.indexOf("{");
  const firstBracket = content.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }
  if (start > 0) return content.slice(start).trim();
  return content.trim();
}

export function tryFixAndParse(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    let fixed = jsonStr;
    const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) fixed += '"';
    const opens = (fixed.match(/[{[]/g) || []).length;
    const closes = (fixed.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      const lastOpen =
        fixed.lastIndexOf("{") > fixed.lastIndexOf("[") ? "}" : "]";
      fixed += lastOpen;
    }
    return JSON.parse(fixed);
  }
}

export interface CallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callMiniMaxJson<T>(opts: CallOptions): Promise<T> {
  const response = await client.chat.completions.create({
    model: MINIMAX_MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 3000,
  });

  const rawContent = response.choices[0]?.message?.content || "";
  const cleaned = stripReasoning(rawContent);
  const jsonStr = extractJson(cleaned);
  return tryFixAndParse(jsonStr) as T;
}

export const FORBIDDEN_FRAUD_NOTE = `严禁建议任何伪造、虚构、购买性质的手段（如购买实习证明、代写简历、虚假经历、代考）；只建议合法的能力积累路径（真实实习申请、开源贡献、开源课程认证、学术竞赛、Kaggle、个人项目等）。`;
export const COMPANY_NO_NAME_NOTE = `绝对不要点名任何具体公司（字节、腾讯、阿里、华为、京东等均不得出现）；只用"互联网大厂""国企""外企""咨询公司""初创公司"等类型化描述。`;
