import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "./lib/session";

/** Early redirect for signed-out visitors; every page and action still re-checks the session. */
export function proxy(req: NextRequest) {
  const signedIn = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value) !== null;
  const onLogin = req.nextUrl.pathname === "/login";
  if (!signedIn && !onLogin) return NextResponse.redirect(new URL("/login", req.url));
  if (signedIn && onLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
