// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get the token from the cookies
  const token = request.cookies.get('DS_TOKEN');
  const isAuthenticated = !!token;
  
  // Define public routes that don't require authentication
  const publicRoutes = ['/landing', '/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Define protected routes that require authentication
  const protectedRoutes = ['/chat', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Redirect authenticated users away from public routes
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }
  
  // Redirect unauthenticated users away from protected routes
  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL('/landing', request.url));
  }
  
  // For the root path, redirect based on authentication status
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/chat', request.url));
    } else {
      return NextResponse.redirect(new URL('/landing', request.url));
    }
  }
  
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
