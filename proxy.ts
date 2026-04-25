import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

const SESSION_OPTS = {
  password: process.env.ADMIN_SESSION_PASSWORD!,
  cookieName: "career_admin_session",
} as const;

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const res = NextResponse.next();
    const session = await getIronSession<{ isAdmin?: boolean }>(
      req,
      res,
      SESSION_OPTS
    );

    if (!session.isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
