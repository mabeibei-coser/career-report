// 从简历纯文本里尽力提取姓名 + 手机号，供后台展示用户联系方式。
// 现实约束：简历是选填的、格式各异、扫描件无文本——提不到就返回 undefined，不强行猜。
// 手机号正则很准；姓名宁缺毋滥（标签式优先 + 顶部启发兜底，否则留空，不给错的）。

// 中国大陆手机号：紧凑 11 位，前后用非数字边界保护，避免从更长数字串里截子串。
// V1 只匹配紧凑写法；带空格/横线分隔（138 1234 5678）的少数会漏，实测如漏多再加。
const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/;

// 简历顶部常见的栏目/标题词——避免把它们误当成姓名。
const NAME_BLOCKLIST = new Set([
  "简历", "个人简历", "求职简历", "应聘简历", "中文简历", "英文简历",
  "个人信息", "基本信息", "个人资料",
  "求职意向", "应聘岗位", "意向岗位", "求职目标",
  "教育背景", "教育经历", "工作经历", "工作经验",
  "项目经历", "项目经验", "实习经历", "实习经验", "校园经历", "在校经历",
  "自我评价", "自我介绍", "联系方式", "专业技能", "技能特长", "荣誉奖项",
]);

export interface ExtractedContact {
  userName?: string;
  userPhone?: string;
}

/** 从简历纯文本提取 { userName, userPhone }；提不到的字段为 undefined。 */
export function extractContact(text: string): ExtractedContact {
  if (!text) return {};
  return {
    userName: extractName(text),
    userPhone: text.match(PHONE_RE)?.[0],
  };
}

function isLikelyName(s: string): boolean {
  return /^[一-龥]{2,4}$/.test(s) && !NAME_BLOCKLIST.has(s);
}

function extractName(text: string): string | undefined {
  // 1) 标签式最可靠："姓名：张三" / "姓 名  张三"
  const labeled = text.match(/姓\s*名[\s:：]*([一-龥]{2,4})(?![一-龥])/);
  if (labeled && isLikelyName(labeled[1])) return labeled[1];

  // 取前 6 个非空行做顶部启发（姓名几乎总在简历最上方）
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6);

  // 2) 整行就是 2-4 个汉字（顶部居中大名最常见）
  for (const line of lines) {
    if (isLikelyName(line)) return line;
  }
  // 3) 行首 2-4 汉字紧跟分隔符（"张三 | 138…" / "张三　求职意向：…"）
  for (const line of lines) {
    const m = line.match(/^([一-龥]{2,4})(?=[\s|｜·,，:：\-])/);
    if (m && isLikelyName(m[1])) return m[1];
  }
  return undefined;
}
