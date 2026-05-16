"use client";

import { useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { isValidCnMobile } from "@/lib/phone";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameError =
    username.length > 0 && !isValidCnMobile(username)
      ? "请输入 11 位大陆手机号"
      : null;

  const canSubmit = isValidCnMobile(username) && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        setLoading(false);
        return;
      }
      // Full page navigation — 避免 Next.js 客户端路由与 middleware 重定向冲突
      window.location.href = "/admin/reports";
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-[#0b1226] overflow-hidden">
      {/* 背景层 1：径向晕染 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(59,130,246,0.22) 0%, rgba(11,18,38,0) 60%), radial-gradient(40% 35% at 100% 100%, rgba(99,102,241,0.14) 0%, rgba(11,18,38,0) 60%), radial-gradient(35% 30% at 0% 80%, rgba(59,130,246,0.08) 0%, rgba(11,18,38,0) 60%)",
        }}
      />
      {/* 背景层 2：细网格 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* 背景层 3：底部装饰光线 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-32 rounded-full bg-blue-500/20 blur-3xl"
      />

      {/* 品牌标识 — 卡片上方 */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm text-[11px] font-medium text-white/70 border border-white/10">
          <Sparkles className="size-3" />
          校招职业定位平台
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          谨世 <span className="text-blue-300">ATA</span>
        </h1>
        <p className="text-[12px] text-white/50">管理后台 · 仅限授权人员</p>
      </div>

      {/* 登录卡片 */}
      <Card className="relative z-10 w-full max-w-sm shadow-2xl shadow-blue-950/50 border-white/[0.08] bg-white/[0.96] backdrop-blur-md">
        <CardContent className="p-6 pt-7">
          {/* 卡片内的小图标 + 标题 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 shadow-md shadow-blue-600/30 ring-1 ring-inset ring-white/20">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-gray-900 tracking-tight">
                欢迎回来
              </div>
              <div className="text-[11px] text-gray-500">用手机号 + 密码登录</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">手机号</Label>
              <Input
                id="username"
                type="tel"
                inputMode="numeric"
                placeholder="11 位大陆手机号"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                autoFocus
                autoComplete="username"
                maxLength={11}
                required
                className="h-10"
                style={{ fontSize: "16px" }}
              />
              {usernameError && (
                <p className="text-xs text-red-600">{usernameError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-10"
                style={{ fontSize: "16px" }}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-10 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm shadow-blue-600/30 disabled:opacity-50 disabled:shadow-none focus-visible:ring-2 focus-visible:ring-blue-400"
              disabled={loading || !canSubmit}
            >
              {loading ? "登录中…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 底部 helper */}
      <p className="relative z-10 mt-6 text-[11px] text-white/40">
        忘记密码？请联系超管重置
      </p>
    </div>
  );
}
