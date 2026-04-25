import Link from "next/link";
import { BarChart3 } from "lucide-react";
import AdminLogoutButton from "./_logout-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <Link
            href="/admin/reports"
            className="flex items-center gap-2 font-semibold text-slate-800"
          >
            <BarChart3 className="size-5 text-blue-600" />
            谨世 ATA 管理后台
          </Link>
          <Link
            href="/admin/reports"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            报告列表
          </Link>
        </div>
        <AdminLogoutButton />
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
