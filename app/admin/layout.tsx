import { AdminSidebar, AdminMobileBar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧 sidebar (desktop) */}
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶部小条 */}
        <AdminMobileBar />
        {/* 主内容 */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
