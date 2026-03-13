import { NextRequest, NextResponse } from 'next/server';

// Middleware runs on edge — we can only check the session cookie exists here.
// Actual role validation happens in the admin API routes themselves (via getSessionWithRole).
// This middleware blocks unauthenticated access to /api/admin/* and /admin.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes — require at least a session cookie
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Redirect non-API admin pages to home
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
