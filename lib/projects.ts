/**
 * 项目元数据中心。
 * admin UI 渲染处必须用这里的 label，不准写 'report'/'nav' 这种 code identifier。
 *
 * 添加新项目（如徐汇/浦东）：在 PROJECTS 里加一项 + admin API 加 schema 即可。
 */

export type ProjectId = "report" | "nav";

export interface ProjectMeta {
  id: ProjectId;
  /** UI 长标签（Tab 标题、详情面包屑） */
  label: string;
  /** UI 短标签（Badge、列表标记） */
  shortLabel: string;
  /** Badge 主色（Tailwind 兼容） */
  color: "blue" | "green" | "purple" | "orange";
  /** 报告章节数（详情页用来标题里显示，可选） */
  sectionCount: number;
}

export const PROJECTS: Record<ProjectId, ProjectMeta> = {
  report: {
    id: "report",
    label: "职业定位",
    shortLabel: "定位",
    color: "blue",
    sectionCount: 6,
  },
  nav: {
    id: "nav",
    label: "职业导航",
    shortLabel: "导航",
    color: "green",
    sectionCount: 5,
  },
};

export const PROJECT_LIST: ProjectMeta[] = Object.values(PROJECTS);

/** 给 ProjectSwitcher 用的选项类型（含可选的 "全部" 入口） */
export interface ProjectOption {
  id: ProjectId | "all";
  label: string;
}

/** 完整选项列表：全部 + 各项目 */
export const PROJECT_OPTIONS: ProjectOption[] = [
  { id: "all", label: "全部" },
  ...PROJECT_LIST.map((p) => ({ id: p.id, label: p.label })),
];
