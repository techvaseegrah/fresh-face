// /src/middleware.ts - FINAL CORRECTED VERSION

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasPermission } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tenant from '@/models/Tenant';
import { getToken } from 'next-auth/jwt';

// ✅ FIX: Throw error immediately if ROOT_DOMAIN is not set.
// This satisfies TypeScript and provides a clear startup error.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
if (!ROOT_DOMAIN) {
  throw new Error('FATAL: NEXT_PUBLIC_ROOT_DOMAIN is not set in the environment variables.');
}

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['dashboard:read'],
  '/crm': ['customers:read'],
  '/appointment': ['appointments:read'],
  '/admin': ['users:read', 'roles:read'],
  '/admin/users': ['users:read'],
  '/admin/roles': ['roles:read'],
  '/DayendClosing': ['dayend:read'],
  '/DayendClosing/history': ['dayend:read']
};

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // ✅ FIX: Check for hostname right away to prevent undefined errors.
  const hostname = request.headers.get('host');
  if (!hostname) {
    return new Response(null, { status: 400, statusText: 'Bad Request: Host header is missing.' });
  }

  console.log(`\n--- [MIDDLEWARE] Request for: ${url.pathname} on Host: ${hostname} ---`);

  // --- 1. Bypass Public Routes ---
  if (
    url.pathname.startsWith('/api/auth') || url.pathname === '/login' ||
    url.pathname.startsWith('/_next') || url.pathname.startsWith('/static') ||
    url.pathname.startsWith('/public') || url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // --- 2. Enforce Root Domain Security Rule ---
  const subdomain = hostname.split('.')[0];
  const isRootDomain = subdomain === 'localhost' || subdomain === 'www' || subdomain === ROOT_DOMAIN.split(':')[0];
  
  if (isRootDomain) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'Please use your salon-specific URL to access this page.');
      return NextResponse.redirect(loginUrl);
  }

  // --- 3. Perform Subdomain Security Checks ---
  await dbConnect();
  const tenant = await Tenant.findOne({ subdomain }).lean();
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!tenant) { return NextResponse.redirect(new URL('/login?error=InvalidSalon', request.url)); }
  if (!token) { return redirectToLogin(request); }
  
  const tenantIdFromHost = tenant._id.toString();
  if (token.tenantId !== tenantIdFromHost) {
      return redirectToLogin(request);
  }

  // --- 4. Perform Role-Based Authorization ---
  const isStaffRoute = url.pathname.startsWith('/staff');
  const userRole = token.role;

  if (isStaffRoute) {
    if (userRole?.name !== 'staff') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  } else {
    const userPermissions = userRole?.permissions || [];
    const requiredPermissions = getRequiredPermissions(url.pathname);
    if (requiredPermissions.length > 0) {
      const hasAccess = requiredPermissions.some(permission => hasPermission(userPermissions, permission));
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }
  }

  // --- 5. Success ---
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantIdFromHost);
  response.headers.set('x-user-id', token.id as string);
  return response;
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function getRequiredPermissions(pathname: string): string[] {
  if (ROUTE_PERMISSIONS[pathname]) { return ROUTE_PERMISSIONS[pathname]; }
  for (const [pattern, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(pattern)) { return permissions; }
  }
  return [];
}

export const config = {
  matcher: [ '/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)' ],
};