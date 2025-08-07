// src/middleware.ts - DEBUG VERSION
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserFromToken, extractTokenFromRequest, hasPermission } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tenant from '@/models/Tenant';

console.log("--- CLEAN REBUILD - MIDDLEWARE LOADED AT " + new Date().toLocaleTimeString() + " ---");

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
if (!ROOT_DOMAIN) {
  throw new Error('NEXT_PUBLIC_ROOT_DOMAIN is not set in the environment variables.');
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
  const hostname = request.headers.get('host') || ROOT_DOMAIN;

  console.log(`\n--- [MIDDLEWARE] Request received for: ${url.pathname} ---`);
  console.log(`[MIDDLEWARE] Host header: ${hostname}`);

  // Exclude special Next.js paths, static assets, and auth routes
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname === '/login' ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.startsWith('/public') ||
    url.pathname === '/favicon.ico'
  ) {
    console.log("[MIDDLEWARE] Path is public or internal. Bypassing.");
    return NextResponse.next();
  }

  // --- SUBDOMAIN EXTRACTION ---
  const subdomain = hostname.split('.')[0];
  console.log(`[MIDDLEWARE] Extracted subdomain: '${subdomain}'`);
  
  if (subdomain === 'www' || subdomain === ROOT_DOMAIN.split(':')[0]) {
    console.log("[MIDDLEWARE] Root domain detected. No tenant ID will be added.");
    // Even on the root domain, we must check for a token for protected pages
  }

  // --- TENANT LOOKUP ---
  await dbConnect();
  const tenant = await Tenant.findOne({ subdomain }).lean();

  if (!tenant) {
    console.error(`[MIDDLEWARE] FAILED: Tenant not found for subdomain '${subdomain}'. Redirecting to root.`);
    const protocol = hostname.includes('localhost') ? 'http://' : 'https';
    const rootUrl = new URL('/', `${protocol}${ROOT_DOMAIN}`);
    return NextResponse.redirect(rootUrl);
  }
  const tenantIdFromHost = tenant._id.toString();
  console.log(`[MIDDLEWARE] Tenant from Host: '${tenant.name}' with ID: ${tenantIdFromHost}`);

  // --- USER AUTHENTICATION ---
  const token = extractTokenFromRequest(request);
  if (!token) {
    console.warn("[MIDDLEWARE] FAILED: No token found. Redirecting to login.");
    return redirectToLogin(request);
  }

  const user = await getUserFromToken(token);
  if (!user) {
    console.error("[MIDDLEWARE] FAILED: Token is present, but getUserFromToken returned null. The token might be invalid or expired.");
    return redirectToLogin(request);
  }
  console.log("[MIDDLEWARE] User decoded from token:", { id: user.id, email: user.email, tenantId: user.tenantId });

  // --- THE CRITICAL SECURITY CHECK ---
  console.log(`[MIDDLEWARE] Comparing Tenant ID from Host ('${tenantIdFromHost}') with User's Tenant ID from Token ('${user.tenantId}')`);
  if (user.tenantId !== tenantIdFromHost) {
    console.error("--- [MIDDLEWARE] SECURITY CHECK FAILED! TENANT ID MISMATCH. ---");
    console.warn(`SECURITY ALERT: User ${user.id} from tenant ${user.tenantId} attempted to access tenant ${tenantIdFromHost}`);
    return redirectToLogin(request);
  }
  console.log("[MIDDLEWARE] Security check PASSED.");

  // --- PERMISSION CHECK ---
  const requiredPermissions = getRequiredPermissions(url.pathname);
  if (requiredPermissions.length > 0) {
    const hasAccess = requiredPermissions.some(permission =>
      hasPermission(user.permissions, permission)
    );

    if (!hasAccess) {
      console.warn(`[MIDDLEWARE] PERMISSION DENIED: User ${user.id} does not have required permissions for ${url.pathname}.`);
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    console.log(`[MIDDLEWARE] Permission check PASSED for ${url.pathname}.`);
  }

  // --- SUCCESS ---
  console.log("[MIDDLEWARE] All checks passed. Adding headers and continuing to the API route.");
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantIdFromHost);
  response.headers.set('x-user-id', user.id);
  response.headers.set('x-user-permissions', JSON.stringify(user.permissions));

  return response;
}

// --- Helper functions (no changes needed) ---
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function getRequiredPermissions(pathname: string): string[] {
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname];
  }
  for (const [pattern, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(pattern)) {
      return permissions;
    }
  }
  return [];
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};