import client, { MINIMAX_MODEL } from "@/lib/minimax";
import type { JobFormData, QuizAnswer } from "@/lib/types";

export const APPLICANT_BASELINE = `用户是应届校招生（无正式工作经验，可能有实习）。
- 薪资按校招起薪：一线 8-10K、新一线 6-8K、二线 5-6K、三线 4K 左右，勿虚高
- 简历维度：教育 + 实习 + 校园项目 + 技能；语气像校招指导老师，避免社招腔`;

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
      formData.resumeText.length > 1500
        ? formData.resumeText.slice(0, 1500) + "\n...(已截断)"
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
  // 找到了合法 JSON 起点（包括起点 0）就从那里切
  if (start >= 0) {
    const sliced = content.slice(start).trim();
    // 再反向找最后一个闭合符，保底截掉 JSON 后的任何尾部解释文字
    const lastBrace = sliced.lastIndexOf("}");
    const lastBracket = sliced.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    return end >= 0 ? sliced.slice(0, end + 1) : sliced;
  }
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

// 全局 JSON 约束前缀：压制模型的"让我分析一下..."/"用户要求..."等前言
// 以及 <think> 外的思考痕迹。不同章节的 system prompt 会 append 在后面
const JSON_ONLY_PREFIX = `【输出约束 · 必须严格遵守】
1. 只输出合法 JSON 对象，第一个字符必须是 {，最后一个字符必须是 }
2. 禁止任何说明性前言（如"让我分析..." "用户要求..." "好的，我来..."）
3. 禁止 markdown 代码围栏（\`\`\`json）
4. 禁止 JSON 之外的任何文字、注释、解释
5. 禁止思考过程被输出到 response 里
6. **严禁原样照抄 schema 模板里的占位符**——如 "..."、"<字段描述>"、"字符串"、"数字" 等示例值都是给你看的说明，你必须把它们**替换为真实内容**（参考具体字段要求）。任何字符串字段都不能是空串、不能是 "..."、不能是 "<...>"
7. 数组字段如果要求"至少 N 条"，必须填满 N 条真实内容，不能返回空数组或"..."

以下是章节具体要求：
`;

// 单章节硬超时（毫秒）：超过这个时间直接 abort，别让个别慢请求拖整体
// M2.7 正常章节 14-40s 完成，设 45s 给足裕量；超过基本就是卡死，等下去也没意义
const SECTION_HARD_TIMEOUT_MS = 45_000;

export async function callMiniMaxJson<T>(opts: CallOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SECTION_HARD_TIMEOUT_MS);
  try {
    const response = await client.chat.completions.create(
      {
        model: MINIMAX_MODEL,
        messages: [
          { role: "system", content: JSON_ONLY_PREFIX + opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 3000,
        // 原生 JSON 模式：约束解码，强制输出合法 JSON
        // 消除"用户要求我..."/"让我分析..."等前言污染
        response_format: { type: "json_object" },
      },
      { signal: controller.signal }
    );

    const rawContent = response.choices[0]?.message?.content || "";
    const cleaned = stripReasoning(rawContent);
    const jsonStr = extractJson(cleaned);
    return tryFixAndParse(jsonStr) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const FORBIDDEN_FRAUD_NOTE = `严禁建议任何伪造、虚构、购买性质的手段（如购买实习证明、代写简历、虚假经历、代考）；只建议合法的能力积累路径（真实实习申请、开源贡献、开源课程认证、学术竞赛、Kaggle、个人项目等）。`;
export const COMPANY_NO_NAME_NOTE = `绝对不要点名任何具体公司（字节、腾讯、阿里、华为、京东等均不得出现）；只用"互联网大厂""国企""外企""咨询公司""初创公司"等类型化描述。`;
