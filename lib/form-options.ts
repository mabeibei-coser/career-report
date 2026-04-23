export const educationLevels = [
  "中专/技校",
  "高职/大专",
  "本科",
  "研究生",
  "博士及以上",
] as const;

export const cityTiers = [
  "一线城市",
  "新一线城市",
  "二线城市",
  "三线及以下城市",
] as const;

export type EducationLevel = (typeof educationLevels)[number];
export type CityTier = (typeof cityTiers)[number];
