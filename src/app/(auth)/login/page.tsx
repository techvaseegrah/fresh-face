'use client';

import { useState, Suspense } from 'react'; 
import { signIn } from 'next-auth/react'; // getSession is not needed here anymore
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {EyeIcon, EyeSlashIcon} from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

function LoginFormWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // --- NEW STATE FOR SALON ID ---
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Pass the new subdomain state to the signIn function
      const result = await signIn('credentials', {
        subdomain, // <-- PASS THE SUBDOMAIN FROM THE FORM
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error || 'Invalid credentials.');
        setIsLoading(false);
        return;
      }
      
      // If login is OK, just navigate to the dashboard on the current domain.
      // ModHeader will handle sending the correct Host header.
      if (result?.ok) {
        const redirectTo = searchParams.get('redirect') || '/dashboard';
        router.push(redirectTo);
      }
    } catch (error) {
      console.error("Client: Error in handleSubmit catch block:", error);
      setError('An error occurred during login');
      setIsLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}
      <div className="space-y-4">
        {/* --- NEW SALON ID INPUT FIELD --- */}
        <div>
          <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
            Salon ID
          </label>
          <input
            id="subdomain"
            name="subdomain"
            type="text"
            required
            autoCapitalize="none"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., admin or glamour"
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
          <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter your email"/>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative mt-1">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter your password"/>
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label={showPassword ? "Hide password" :"Show password"}>
              {showPassword ? (<EyeSlashIcon className="h-5 w-5 text-gray-500" />) : (<EyeIcon className="h-5 w-5 text-gray-500" />)}
            </button>
          </div>
        </div>
      </div>

      <div>
        <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-50">
          {isLoading ? (<div className="flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Signing in...</div>) : ('Sign in')}
        </button>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">Sign up here</Link>
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">FF</span>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to Fresh Face</h2>
            <p className="mt-2 text-sm text-gray-600">Salon Management System</p>
          </div>
          <Suspense fallback={null}>
            <LoginFormWrapper />
          </Suspense>
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
            <p className="text-xs text-gray-600">
              Email: superadmin@freshface.com
              <br />
              Password: SuperAdmin123!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}