"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
    <div className="relative min-h-dvh flex items-center justify-center px-4 bg-[#0f172a]">
      {/* 背景：径向晕染 + 细网格，替换通用对角灰渐变 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(15,23,42,0) 60%), radial-gradient(40% 35% at 100% 100%, rgba(96,165,250,0.10) 0%, rgba(15,23,42,0) 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <Card className="relative w-full max-w-sm shadow-2xl shadow-blue-950/40 border-slate-200/60 backdrop-blur-sm">
        <CardHeader className="space-y-1.5 text-center pb-4">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 shadow-md shadow-blue-600/30 ring-1 ring-inset ring-white/20">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <CardTitle className="text-xl tracking-tight">管理员登录</CardTitle>
          <p className="text-sm text-muted-foreground">谨世 ATA 后台管理系统</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">手机号</Label>
              <Input
                id="username"
                type="tel"
                inputMode="numeric"
                placeholder="请输入登录手机号"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                autoFocus
                autoComplete="username"
                maxLength={11}
                required
                style={{ fontSize: "16px" }}
              />
              {usernameError && (
                <p className="text-xs text-destructive">{usernameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ fontSize: "16px" }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading || !canSubmit}
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
