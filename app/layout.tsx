import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 职业定位报告",
  description: "智能职业定位分析系统 - 社保局职业咨询辅助工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
