// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'localhost:3000';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host')!;

  // 1. Allow public assets and auth API calls
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') // Allow static files
  ) {
    return NextResponse.next();
  }

  // 2. Extract subdomain (removes `.MAIN_DOMAIN` from host)
  const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');

  // 3. If it's the main domain, allow
  if (host === MAIN_DOMAIN) {
    return NextResponse.next();
  }

  // 4. Allow login page without token
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // 5. Get token
  const token = await getToken({ req, secret });

  // 6. Redirect if no token
  if (!token) {
    const loginUrl = new URL('/login', `http://${host}`);
    return NextResponse.redirect(loginUrl);
  }

  // 7. Ensure token subdomain matches
  if (token.subdomain !== subdomain) {
    const correctHost = `${token.subdomain}.${MAIN_DOMAIN}`;
    const correctLoginUrl = new URL('/login', `http://${correctHost}`);
    correctLoginUrl.searchParams.set('error', 'MismatchedSalon');
    return NextResponse.redirect(correctLoginUrl);
  }

  // 8. Rewrite path for tenant routing
  const url = req.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
