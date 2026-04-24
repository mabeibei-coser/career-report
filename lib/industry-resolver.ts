/**
 * 行业推断
 * ————————
 * 每个章节 API 各自用 LLM 从 targetCompany 推断行业会产生互相矛盾的结论
 * （"浦发建设" 一个猜金融、一个猜建筑）。这里基于关键词做**确定性推断**，
 * 注入所有章节的 baseContext，让各 LLM 统一使用同一个行业字符串。
 *
 * 优先级：具体企业名（priority 10）> 通用行业词（priority 5）。
 * 复合名字（"浦发建设"）两边命中时，具体企业胜出（"浦发" → 金融/银行）。
 */

interface IndustryRule {
  industry: string;
  keywords: string[];
  priority: number;
}

export const INDUSTRY_RULES: IndustryRule[] = [
  // === 具体企业名（priority 10，优先级最高） ===
  {
    industry: "金融/银行",
    priority: 10,
    keywords: [
      "浦发", "招商银行", "中信银行", "工商银行", "建设银行", "农业银行",
      "中国银行", "交通银行", "民生银行", "兴业银行", "光大银行", "平安银行",
      "宁波银行", "北京银行", "招行", "工行", "建行", "农行", "中行",
      "国泰君安", "华泰", "中信证券", "中金", "东方证券", "海通证券",
      "中信保诚", "平安保险", "中国人寿", "新华保险", "太平洋保险",
    ],
  },
  {
    industry: "互联网/软件",
    priority: 10,
    keywords: [
      "字节", "腾讯", "阿里", "百度", "京东", "美团", "滴滴", "拼多多",
      "小米", "网易", "头条", "抖音", "小红书", "b站", "哔哩哔哩",
      "知乎", "快手", "携程", "蔚来", "理想", "小鹏", "微博", "网易云",
    ],
  },
  {
    industry: "硬件/半导体",
    priority: 10,
    keywords: [
      "华为", "中兴", "联想", "海康", "大疆", "海思", "展锐", "紫光",
      "比亚迪电子", "歌尔", "立讯", "舜宇",
    ],
  },
  {
    industry: "汽车/新能源",
    priority: 10,
    keywords: [
      "比亚迪", "宁德时代", "吉利", "长城", "奇瑞", "广汽", "上汽",
      "北汽", "一汽", "东风",
    ],
  },
  {
    industry: "能源/电力",
    priority: 10,
    keywords: [
      "国家电网", "南方电网", "中石油", "中石化", "中海油", "国家能源",
      "华能", "大唐", "华电", "国电", "中广核",
    ],
  },
  {
    industry: "咨询/审计",
    priority: 10,
    keywords: [
      "麦肯锡", "bcg", "贝恩", "罗兰贝格", "埃森哲", "德勤", "普华永道",
      "毕马威", "安永", "四大",
    ],
  },

  // === 通用行业词（priority 5） ===
  {
    industry: "金融/银行",
    priority: 5,
    keywords: [
      "银行", "证券", "基金", "保险", "信托", "金融", "资管", "财富管理",
      "租赁", "信贷",
    ],
  },
  {
    industry: "互联网/软件",
    priority: 5,
    keywords: [
      "互联网", "科技公司", "数字化", "saas", "云服务", "大数据", "ai",
      "人工智能",
    ],
  },
  {
    industry: "地产/建筑",
    priority: 5,
    keywords: [
      "地产", "建筑", "建设", "施工", "设计院", "房地产", "物业", "建工",
    ],
  },
  {
    industry: "能源/电力",
    priority: 5,
    keywords: ["能源", "石油", "电力", "电网", "煤炭", "燃气", "新能源"],
  },
  {
    industry: "咨询/审计",
    priority: 5,
    keywords: ["咨询", "审计", "会计师事务所", "律所", "律师事务所"],
  },
  {
    industry: "消费/零售",
    priority: 5,
    keywords: [
      "零售", "连锁", "餐饮", "食品", "饮料", "商超", "电商", "快消",
    ],
  },
  {
    industry: "制造/汽车",
    priority: 5,
    keywords: ["汽车", "制造", "机械", "重工", "装备"],
  },
  {
    industry: "医药/医疗",
    priority: 5,
    keywords: ["医药", "医疗", "生物", "药业", "制药", "健康"],
  },
  {
    industry: "教育/培训",
    priority: 5,
    keywords: ["教育", "培训", "学校", "学院", "学习"],
  },
  {
    industry: "物流/供应链",
    priority: 5,
    keywords: ["物流", "供应链", "快递", "货运", "仓储"],
  },
];

export type IndustryConfidence = "high" | "medium" | "low";

export interface IndustryGuess {
  industry: string;
  confidence: IndustryConfidence;
}

/**
 * 基于关键词做确定性行业推断。
 * - 命中 priority=10 规则 → high 置信度
 * - 命中 priority=5 规则 → medium
 * - 全不命中 → industry="通用"，low
 */
export function inferIndustry(targetCompany: string): IndustryGuess {
  if (!targetCompany) return { industry: "通用", confidence: "low" };
  const norm = targetCompany.toLowerCase();
  const matches = INDUSTRY_RULES.filter((rule) =>
    rule.keywords.some((k) => norm.includes(k.toLowerCase()))
  );
  if (matches.length === 0) return { industry: "通用", confidence: "low" };
  matches.sort((a, b) => b.priority - a.priority);
  const top = matches[0];
  return {
    industry: top.industry,
    confidence: top.priority >= 10 ? "high" : "medium",
  };
}
