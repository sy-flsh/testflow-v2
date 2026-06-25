import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "tf_session";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard",
    "/projects",
    "/projects/:path*",
    "/settings",
    // c7-1: 회사 관리(회원 관리) 페이지도 미인증 시 로그인으로 리다이렉트
    "/company/:path*",
  ],
};
