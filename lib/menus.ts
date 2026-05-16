/**
 * 菜单权限元数据。
 * 菜单和权限 1:1 直连：menus_json 存什么 key，老师就能看哪个菜单。
 * 不引入 wildcard，不自动联动。
 *
 * 未来在 lib/projects.ts PROJECTS 里加新项目（如"徐汇"），
 * ASSIGNABLE_MENUS 自动多出一个勾选项，无需修改本文件。
 */

import { PROJECT_LIST, type ProjectId } from "./projects";

// sidebar 实际菜单 key。"admins" 由 is_super 派生，不存入 menus_json。
export type MenuKey = "all" | ProjectId | "admins";

/**
 * 管理员表单可分配的权限选项（3 个独立勾选框，互不联动）。
 * "admins" 不在此列表——超管身份由 is_super 字段单独控制。
 */
export const ASSIGNABLE_MENUS: ReadonlyArray<{
  key: "all" | ProjectId;
  label: string;
  description: string;
}> = [
  { key: "all", label: "全部", description: "两个项目合计的聚合视图" },
  ...PROJECT_LIST.map((p) => ({
    key: p.id,
    label: p.label,
    description: p.description ?? p.label,
  })),
];

/** 极简 1:1 包含判断：超管自动 true；否则看 menus 数组是否包含该 key。 */
export function canViewMenu(
  s: { isSuper?: boolean; menus?: Array<"all" | ProjectId> },
  menu: "all" | ProjectId
): boolean {
  if (s.isSuper) return true;
  return s.menus?.includes(menu) ?? false;
}

/**
 * 派生当前 session 能看哪些菜单。
 * sidebar 用这个结果决定哪些 nav item 可见。
 */
export function deriveVisibleMenus(s: {
  isSuper?: boolean;
  menus?: Array<"all" | ProjectId>;
}): {
  showAll: boolean;
  visibleProjects: ProjectId[];
  showAdmins: boolean;
} {
  return {
    showAll: canViewMenu(s, "all"),
    visibleProjects: PROJECT_LIST.filter((p) => canViewMenu(s, p.id)).map(
      (p) => p.id
    ),
    showAdmins: !!s.isSuper,
  };
}
