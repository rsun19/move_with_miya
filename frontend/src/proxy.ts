import { NextRequest, NextResponse } from 'next/server';
import { USER_SERVICE_URL } from '@/lib/env';

const SESSION_COOKIE = 'connect.sid';

const PUBLIC_PATHS = ['/login', '/classes', '/'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie');
  const hasSessionCookie =
    cookieHeader
      ?.split(';')
      .some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`)) ?? false;

  const redirectToLogin = () => {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  };

  if (!hasSessionCookie) {
    return redirectToLogin();
  }

  try {
    const res = await fetch(`${USER_SERVICE_URL}/auth/me`, {
      headers: { cookie: cookieHeader as string },
      cache: 'no-store',
    });
    if (!res.ok) {
      return redirectToLogin();
    }
  } catch (error) {
    console.error('Middleware auth verification failed:', error);
    return redirectToLogin();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
