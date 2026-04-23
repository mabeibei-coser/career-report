/**
 * 应届校招一线城市起薪锚点（月薪，元/月）。
 * 用于注入报告 prompt，让 AI 在合理区间内生成薪资数据，减少随机性。
 */

export interface SalaryAnchor {
  keywords: string[];
  label: string;
  tier1: { low: number; median: number; high: number };
}

// 一线城市应届校招起薪锚点（月薪，元/月）——对准「普通本科+985/211 混合池」的真实中位数，
// 不要套用 top-tier 录用情况，否则对大多数候选人而言偏高并误导期望。
export const salaryAnchors: SalaryAnchor[] = [
  {
    keywords: ["产品", "产品经理", "pm"],
    label: "产品类",
    tier1: { low: 6000, median: 8500, high: 14000 },
  },
  {
    keywords: ["研发", "开发", "后端", "前端", "全栈", "工程师", "软件", "算法", "ai", "机器学习", "数据科学"],
    label: "技术研发类",
    tier1: { low: 10000, median: 15000, high: 25000 },
  },
  {
    keywords: ["测试", "qa", "运维", "sre", "devops"],
    label: "测试运维类",
    tier1: { low: 8000, median: 11000, high: 16000 },
  },
  {
    keywords: ["数据分析", "bi", "分析师"],
    label: "数据分析类",
    tier1: { low: 7000, median: 10000, high: 15000 },
  },
  {
    keywords: ["设计", "ui", "ux", "视觉", "交互"],
    label: "设计类",
    tier1: { low: 6000, median: 8500, high: 13000 },
  },
  {
    keywords: ["运营", "内容", "市场", "市场营销", "marketing"],
    label: "运营/市场类",
    tier1: { low: 5000, median: 7000, high: 11000 },
  },
  {
    keywords: ["销售", "bd", "商务"],
    label: "销售/商务类",
    tier1: { low: 5000, median: 8000, high: 14000 },
  },
  {
    keywords: ["人力", "hr", "人事", "招聘", "薪酬"],
    label: "人力资源类",
    tier1: { low: 5000, median: 7000, high: 10000 },
  },
  {
    keywords: ["财务", "会计", "审计", "税务"],
    label: "财务类",
    tier1: { low: 5000, median: 6500, high: 10000 },
  },
  {
    keywords: ["法务", "律师", "合规"],
    label: "法务合规类",
    tier1: { low: 6000, median: 8500, high: 14000 },
  },
  {
    keywords: ["咨询", "consultant", "策略"],
    label: "咨询类",
    tier1: { low: 8000, median: 12000, high: 20000 },
  },
];

export const cityCoefficients = [
  { tier: "一线城市", coefficient: 1.0, sampleCity: "北京 / 上海 / 深圳 / 广州" },
  { tier: "新一线城市", coefficient: 0.8, sampleCity: "杭州 / 成都 / 武汉 / 南京" },
  { tier: "二线城市", coefficient: 0.65, sampleCity: "厦门 / 青岛 / 合肥 / 长沙" },
  { tier: "三线及以下城市", coefficient: 0.5, sampleCity: "大部分三四线及地级市" },
] as const;

export function matchAnchor(position: string): SalaryAnchor {
  const normalized = position.toLowerCase();
  const matched = salaryAnchors.find((a) =>
    a.keywords.some((k) => normalized.includes(k.toLowerCase()))
  );
  return matched ?? {
    keywords: [],
    label: "通用岗位",
    tier1: { low: 5000, median: 7500, high: 12000 },
  };
}

export function buildSalaryAnchorPrompt(
  position: string,
  education?: string,
  resumeText?: string
): string {
  const anchor = matchAnchor(position);
  const lines = [
    `岗位大类匹配：${anchor.label}`,
    `校招一线城市月薪参考区间（元/月）：低分位 ${anchor.tier1.low} / 中位 ${anchor.tier1.median} / 高分位 ${anchor.tier1.high}`,
    `城市系数（以一线为 1.0）：新一线 0.8 / 二线 0.65 / 三线及以下 0.5`,
    `这些锚点对应「普通本科 + 985/211 混合池的真实中位」，不要直接给 top-tier 大厂 top-30% 录用数字，否则对大多数候选人会偏高。`,
  ];

  if (education) {
    lines.push(`候选人学历：${education}`);
    if (education.includes("博士")) {
      lines.push(`→ 学历加成：可在锚点基础上上浮 20-30%（博士在对口岗位校招中起薪明显更高）。`);
    } else if (education.includes("研究生") || education.includes("硕士")) {
      lines.push(`→ 学历加成：可在锚点基础上上浮 10-15%。`);
    } else if (education.includes("本科")) {
      lines.push(`→ 本科作为锚点参照，按原值给出，不做学历加成。`);
    } else if (education.includes("大专") || education.includes("高职")) {
      lines.push(`→ 大专/高职：在锚点基础上下调 10-15%（应届市场对非本科背景的一般水位）。`);
    } else if (education.includes("中专") || education.includes("技校")) {
      lines.push(`→ 中专/技校：在锚点基础上下调 20-30%，部分岗位（技术研发/金融总部）可能根本不向该学历开放，数字应更保守。`);
    } else {
      lines.push(`→ 无明显学历加成，按锚点原值给出。`);
    }
  }

  if (resumeText && resumeText.length > 200) {
    lines.push(
      `候选人有简历。请基于简历里真实可见的实习/项目质量做小幅浮动（±10%），**不要**脱离锚点给出远超的虚高数字。`
    );
  } else {
    lines.push(`候选人未上传简历或信息有限，按锚点中枢给，不要过度上浮。`);
  }

  lines.push(
    `⚠ 重要：数字**不要给整百整千**（避免 8000/12000/15000 这种一看就是套话的数字）。请给出更贴近真实统计口径的非圆整数字，如 6280、8340、11780、15420、22640 这种像从统计报表里抄下来的数字。`
  );

  return lines.join("\n");
}
