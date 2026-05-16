"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-100">
            <Lock className="size-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">管理员登录</CardTitle>
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
