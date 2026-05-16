"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  LayoutGrid,
  Briefcase,
  Compass,
  LogOut,
  Users,
  KeyRound,
  ShieldCheck,
  UserCircle2,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PROJECTS } from "@/lib/projects";
import { ChangePasswordDialog } from "./change-password-dialog";

type ProjectFilter = "all" | "report" | "nav";

interface MeData {
  name: string;
  username: string;
  isSuper: boolean;
  showAll: boolean;
  visibleProjects: string[];
  showAdmins: boolean;
}

/** 图标映射：project id → icon component */
const PROJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  report: Briefcase,
  nav: Compass,
};

/** 从 /api/admin/me 获取当前用户数据。加载中返回 null。 */
function useAdminMe() {
  const [data, setData] = useState<MeData | null>(null);
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);
  return data;
}

export function AdminSidebar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const me = useAdminMe();

  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

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
    <>
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />

      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-60 shrink-0 border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <Link
            href="/admin/reports"
            className="flex items-center gap-2.5 font-semibold text-gray-800"
          >
            <div className="size-9 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30 ring-1 ring-inset ring-white/20">
              <Layers className="size-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm tracking-tight">谨世 ATA</div>
              <div className="text-[10px] text-gray-400 font-normal">管理后台</div>
            </div>
          </Link>
        </div>

        {/* 报告管理 section */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2">
          <div className="text-xs text-gray-400 font-medium shrink-0">
            报告管理
          </div>
          <div className="h-px flex-1 bg-gray-100" />
        </div>
        <nav className="px-3 flex flex-col gap-0.5">
          {/* 全部 */}
          {(!me || me.showAll) && (
            <SidebarNavItem
              id="all"
              label="全部"
              description="两个项目合计"
              icon={LayoutGrid}
              active={currentProject === "all"}
              href="/admin/reports?project=all"
            />
          )}
          {/* 各项目 */}
          {(!me ? (["report", "nav"] as string[]) : me.visibleProjects).map(
            (pid) => {
              const meta = PROJECTS[pid as keyof typeof PROJECTS];
              if (!meta) return null;
              const Icon = PROJECT_ICONS[pid] ?? Briefcase;
              return (
                <SidebarNavItem
                  key={pid}
                  id={pid}
                  label={meta.label}
                  description={meta.description ?? ""}
                  icon={Icon}
                  active={currentProject === pid}
                  href={`/admin/reports?project=${pid}`}
                />
              );
            }
          )}
        </nav>

        {/* 系统管理 section — 仅超管可见 */}
        {(!me || me.showAdmins) && (
          <>
            <div className="px-5 pt-5 pb-2 flex items-center gap-2">
              <div className="text-xs text-gray-400 font-medium shrink-0">
                系统管理
              </div>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <nav className="px-3 flex flex-col gap-0.5">
              <Link
                href="/admin/admins"
                className={`
                  group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
                  ${
                    pathname.startsWith("/admin/admins")
                      ? "bg-gray-50 text-gray-900 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                {pathname.startsWith("/admin/admins") && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-600" />
                )}
                <Users
                  className={`size-4 ${
                    pathname.startsWith("/admin/admins")
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                />
                管理员管理
              </Link>
            </nav>
          </>
        )}

        {/* Bottom: 用户块 + 操作 */}
        <div className="mt-auto p-3 border-t border-gray-100">
          {/* 用户身份块 */}
          <div className="px-3 py-2.5 flex items-center gap-2.5 mb-1">
            <div className="relative shrink-0">
              <div className="size-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <UserCircle2 className="size-4 text-blue-600" />
              </div>
              {me?.isSuper && (
                <ShieldCheck className="absolute -bottom-0.5 -right-0.5 size-3 text-blue-600 bg-white rounded-full" />
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-medium text-gray-800 truncate">
                {me?.name ?? "—"}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">
                {me?.username
                  ? `${me.username.slice(0, 3)} •••• ${me.username.slice(-4)}`
                  : ""}
                {me?.isSuper && <span className="ml-1 text-blue-600">· 超管</span>}
              </div>
            </div>
          </div>

          <button
            onClick={() => setPwdDialogOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <KeyRound className="size-4 text-gray-400" />
            修改密码
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <LogOut className="size-4 text-gray-400" />
            {loggingOut ? "登出中…" : "登出"}
          </button>
        </div>
      </aside>
    </>
  );
}

/** Shared nav item for desktop sidebar */
function SidebarNavItem({
  id,
  label,
  description,
  icon: Icon,
  active,
  href,
}: {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      key={id}
      href={href}
      className={`
        group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
        ${
          active
            ? "bg-gray-50 text-gray-900 font-semibold"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-600" />
      )}
      <Icon className={`size-4 ${active ? "text-blue-600" : "text-gray-400"}`} />
      <div className="flex-1 leading-tight">
        <div>{label}</div>
        <div
          className={`text-[10px] mt-0.5 font-normal ${
            active ? "text-gray-500" : "text-gray-400"
          }`}
        >
          {description}
        </div>
      </div>
    </Link>
  );
}

/** Mobile top bar — 移动端折叠成顶部小条，同样按权限过滤 */
export function AdminMobileBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const me = useAdminMe();

  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

  if (pathname === "/admin/login") return null;

  // 在 me 加载前显示骨架（loading 状态）
  const showAll = !me || me.showAll;
  const visibleProjects: string[] = me ? me.visibleProjects : ["report", "nav"];

  return (
    <>
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />
      <div className="md:hidden border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-3 overflow-x-auto">
        <Link
          href="/admin/reports"
          className="flex items-center gap-1.5 font-semibold text-gray-800 shrink-0"
        >
          <div className="size-5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30">
            <Layers className="size-3 text-white" />
          </div>
          <span className="text-sm tracking-tight">谨世 ATA</span>
        </Link>
        <div className="h-4 w-px bg-gray-200 shrink-0" />
        <div className="flex gap-1 shrink-0 overflow-x-auto">
          {showAll && (
            <Link
              href="/admin/reports?project=all"
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                currentProject === "all"
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              全部
            </Link>
          )}
          {visibleProjects.map((pid) => {
            const meta = PROJECTS[pid as keyof typeof PROJECTS];
            if (!meta) return null;
            return (
              <Link
                key={pid}
                href={`/admin/reports?project=${pid}`}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                  currentProject === pid
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {meta.label}
              </Link>
            );
          })}
        </div>
        {/* 修改密码 — 右侧图标按钮 */}
        <button
          onClick={() => setPwdDialogOpen(true)}
          className="ml-auto shrink-0 size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="修改密码"
        >
          <KeyRound className="size-3.5" />
        </button>
      </div>
    </>
  );
}
