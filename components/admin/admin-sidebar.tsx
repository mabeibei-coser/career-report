"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { BarChart3, LayoutGrid, Briefcase, Compass, LogOut } from "lucide-react";
import { useState } from "react";

type ProjectFilter = "all" | "report" | "nav";

const MENU_ITEMS: Array<{
  id: ProjectFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { id: "all", label: "全部", icon: LayoutGrid, description: "两个项目合计" },
  { id: "report", label: "职业定位", icon: Briefcase, description: "应届校招报告" },
  { id: "nav", label: "职业导航", icon: Compass, description: "求职指导报告" },
];

export function AdminSidebar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

  // 登录页不显示 sidebar（让登录卡片居中）
  if (pathname === "/admin/login") return null;

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 lg:w-60 shrink-0 border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <Link
          href="/admin/reports"
          className="flex items-center gap-2 font-semibold text-gray-800"
        >
          <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 className="size-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm">谨世 ATA</div>
            <div className="text-[10px] text-gray-400 font-normal">管理后台</div>
          </div>
        </Link>
      </div>

      {/* Section title */}
      <div className="px-5 pt-5 pb-2">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
          报告管理
        </div>
      </div>

      {/* Menu */}
      <nav className="px-3 flex flex-col gap-0.5">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentProject === item.id;
          return (
            <Link
              key={item.id}
              href={`/admin/reports?project=${item.id}`}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
              `}
            >
              <Icon className={`size-4 ${active ? "text-blue-600" : "text-gray-400"}`} />
              <div className="flex-1 leading-tight">
                <div>{item.label}</div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    active ? "text-blue-500" : "text-gray-400"
                  }`}
                >
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: logout */}
      <div className="mt-auto p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50"
        >
          <LogOut className="size-4 text-gray-400" />
          {loggingOut ? "登出中…" : "登出"}
        </button>
      </div>
    </aside>
  );
}

/** Mobile top bar — sidebar 在移动端折叠成顶部小条，简化版 */
export function AdminMobileBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

  if (pathname === "/admin/login") return null;

  return (
    <div className="md:hidden border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-3 overflow-x-auto">
      <Link
        href="/admin/reports"
        className="flex items-center gap-1.5 font-semibold text-gray-800 shrink-0"
      >
        <BarChart3 className="size-4 text-blue-600" />
        <span className="text-sm">谨世 ATA</span>
      </Link>
      <div className="h-4 w-px bg-gray-200 shrink-0" />
      <div className="flex gap-1 shrink-0">
        {MENU_ITEMS.map((item) => {
          const active = currentProject === item.id;
          return (
            <Link
              key={item.id}
              href={`/admin/reports?project=${item.id}`}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                active
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
