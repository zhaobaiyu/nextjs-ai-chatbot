import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  guestRegex,
  isDevelopmentEnvironment,
  isGuestModeEnabled,
  isRegistrationEnabled,
} from "./lib/constants";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Allow unauthenticated access to login page
  if (!token && pathname === "/login") {
    return NextResponse.next();
  }

  // Allow unauthenticated access to register page only if registration is enabled
  if (!token && pathname === "/register") {
    if (!isRegistrationEnabled) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    if (isGuestModeEnabled) {
      const redirectUrl = encodeURIComponent(request.url);
      return NextResponse.redirect(
        new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  // Redirect authenticated non-guest users away from login/register pages
  if (token && !isGuest && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect authenticated non-guest users away from register page
  if (token && !isGuest && pathname === "/register") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect to login if trying to access register page when registration is disabled
  if (pathname === "/register" && !isRegistrationEnabled) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
