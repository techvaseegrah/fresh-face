// app/(auth)/login/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { signIn, getSession, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.push(redirectTo);
    }
  }, [session, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        // Get fresh session to ensure user data is loaded
        const session = await getSession();
        if (session) {
          const redirectTo = searchParams.get('redirect') || '/dashboard';
          router.push(redirectTo);
        }
      }
    } catch (error) {
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  if (session) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-black rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">FF</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to Fresh Face
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Salon Management System
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign up here
              </Link>
            </p>
          </div>
        </form>

        {/* Demo Credentials (Remove in production) */}
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
          <p className="text-xs text-gray-600">
            Email: superadmin@freshface.com<br/>
            Password: SuperAdmin123!
          </p>
        </div>
      </div>
    </div>
  );
}