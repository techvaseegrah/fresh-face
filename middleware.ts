// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public assets and API calls pass through without checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') || // Allow auth API calls
    pathname.includes('.') ||
    pathname === '/login' // Allow access to the login page
  ) {
    return NextResponse.next();
  }

  // 1. Get the subdomain from the URL host
  const host = req.headers.get('host')!;
  const currentSubdomain = host.split('.')[0];

  // 2. Decode the user's session token from the cookie
  const token = await getToken({ req, secret });

  // 3. If there's no token, the user is not logged in. Redirect to the correct login page.
  if (!token) {
    const loginUrl = new URL('/login', `http://${host}`);
    return NextResponse.redirect(loginUrl);
  }

  // 4. This is the CRITICAL CHECK
  // Compare the subdomain from the URL with the subdomain in the user's session token.
  if (token.subdomain !== currentSubdomain) {
    // The user is on the wrong subdomain!
    // Example: token.subdomain is 'admin', but currentSubdomain is 'glamour'
    
    // Log them out and redirect to the correct login page to prevent confusion.
    // A more advanced solution could redirect to `admin.localhost`, but logout is safest.
    const loginUrl = new URL('/login', `http://${host}`);
    loginUrl.searchParams.set('error', 'MismatchedSalon'); // Optional: show an error
    
    // To properly log out, we would ideally call the signout endpoint,
    // but a redirect is the simplest middleware action.
    return NextResponse.redirect(loginUrl);
  }

  // 5. If everything matches, let the request continue.
  return NextResponse.next();
}

// Configure the middleware to run on most paths
export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};