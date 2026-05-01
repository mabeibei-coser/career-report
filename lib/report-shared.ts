import client, { MINIMAX_MODEL } from "@/lib/minimax";
import iflytek, { IFLYTEK_MODEL } from "@/lib/iflytek";
import type { JobFormData, QuizAnswer } from "@/lib/types";
import { inferIndustry } from "@/lib/industry-resolver";

export const APPLICANT_BASELINE = `用户是应届校招生（无正式工作经验，可能有实习）。
- 薪资按校招起薪：一线 8-10K、新一线 6-8K、二线 5-6K、三线 4K 左右，勿虚高
- 简历维度：教育 + 实习 + 校园项目 + 技能；语气像校招指导老师，避免社招腔`;

export function buildBaseContext(
  formData: JobFormData,
  quizAnswers?: QuizAnswer[],
  interviewSummary?: string
): string {
  // 系统预推断行业，注入给所有 section；各章节 prompt 应以此为准、不要自行再推断
  // 避免出现第 2 章说"建筑"、第 6 章说"金融"这种章节间矛盾
  const { industry, confidence } = inferIndustry(formData.targetCompany);

  const parts = [
    "求职意向信息：",
    `- 意向岗位：${formData.targetPosition}`,
    `- 意向学历：${formData.targetEducation}`,
    `- 意向公司/类型：${formData.targetCompany}`,
    `- 意向城市能级：${formData.targetCityTier}`,
    `- 系统推断行业：${industry}（置信度：${confidence}；各章节必须与此保持一致，不要跨行业联想）`,
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

  if (interviewSummary) {
    parts.push("\n两轮访谈摘要：\n" + interviewSummary);
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

// 单章节硬超时（毫秒）：50s
// M2.7 正常章节 14-45s 完成；超过 50s 基本是卡住或吐错 JSON 要重试
// 50s × 2 次 = 100s 上限，控制用户最坏等待在 ~100s 内
// 超时章节自动 fallback mock，保证报告一定能出
const SECTION_HARD_TIMEOUT_MS = 50_000;

export async function callMiniMaxJson<T>(
  opts: CallOptions & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? SECTION_HARD_TIMEOUT_MS
  );
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

// 讯飞 fallback：镜像 callMiniMaxJson 的结构和后处理管线
// 与 MiniMax 的区别：
// 1. 使用 iflytek client（可能为 null，未配 key 时抛错）
// 2. model 用 IFLYTEK_MODEL（默认 astron-code-latest）
// 3. 其他（JSON_ONLY_PREFIX / response_format / stripReasoning / extractJson / tryFixAndParse）完全一致
export async function callIflytekJson<T>(
  opts: CallOptions & { timeoutMs?: number }
): Promise<T> {
  if (!iflytek) throw new Error("讯飞 fallback 未配置");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? SECTION_HARD_TIMEOUT_MS
  );
  try {
    const response = await iflytek.chat.completions.create(
      {
        model: IFLYTEK_MODEL,
        messages: [
          { role: "system", content: JSON_ONLY_PREFIX + opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 3000,
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

/**
 * 章节 AI 调用的统一入口：MiniMax 主 → iFlytek fallback。
 *
 * **失败**包含三种情况，任一出现都会触发切换讯飞 key 重试：
 * 1. API 调用错误（429/529/超时/网络）
 * 2. JSON 解析失败（模型吐残缺 JSON）
 * 3. `validator` 返回非 null 字符串（内容校验不通过——字段缺失/占位符/空串）
 *
 * 两家都失败才抛**原始 MiniMax 错误**（第一手信息便于排查）。
 * 未配 IFLYTEK_API_KEY 时自动退化为单路 MiniMax，调用方无需改 env。
 */
export async function callWithFallback<T>(
  opts: CallOptions & {
    timeoutMs?: number;
    /** 返回 null = 通过；返回字符串 = 错误原因，触发 fallback */
    validator?: (data: T) => string | null;
  }
): Promise<T> {
  const { validator, ...callOpts } = opts;
  const runOnce = async (
    caller: "minimax" | "iflytek",
    sectionName: string
  ): Promise<T> => {
    const data =
      caller === "minimax"
        ? await callMiniMaxJson<T>(callOpts)
        : await callIflytekJson<T>(callOpts);
    if (validator) {
      const issue = validator(data);
      if (issue) throw new Error(`[${sectionName}] 内容校验失败: ${issue}`);
    }
    return data;
  };

  try {
    return await runOnce("minimax", "MiniMax");
  } catch (miniMaxErr) {
    if (!iflytek) throw miniMaxErr;
    const miniMsg =
      miniMaxErr instanceof Error ? miniMaxErr.message : String(miniMaxErr);
    console.warn("[fallback] MiniMax 失败/校验不通过，切换讯飞重试:", miniMsg);
    try {
      return await runOnce("iflytek", "iFlytek");
    } catch (iflytekErr) {
      const ifMsg =
        iflytekErr instanceof Error ? iflytekErr.message : String(iflytekErr);
      console.warn("[fallback] 讯飞也失败:", ifMsg);
      throw miniMaxErr; // 抛原始 MiniMax 错误，看到首因
    }
  }
}

export const FORBIDDEN_FRAUD_NOTE = `严禁建议任何伪造、虚构、购买性质的手段（如购买实习证明、代写简历、虚假经历、代考）；只建议合法的能力积累路径（真实实习申请、开源贡献、开源课程认证、学术竞赛、Kaggle、个人项目等）。`;
export const COMPANY_NO_NAME_NOTE = `绝对不要点名任何具体公司（字节、腾讯、阿里、华为、京东等均不得出现）；只用"互联网大厂""国企""外企""咨询公司""初创公司"等类型化描述。`;
