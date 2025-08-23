// /app/(auth)/login/page.tsx

'use client';

import React, { useState, FormEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Building, User, KeyRound } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>('admin');
  
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [staffIdNumber, setStaffIdNumber] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let result;
      if (loginMode === 'admin') {
        result = await signIn('credentials', {
          subdomain,
          email,
          password,
          redirect: false,
        });
      } else {
        result = await signIn('staff-credentials', {
          subdomain,
          staffIdNumber,
          password,
          redirect: false,
        });
      }

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      if (result?.ok) {
        const redirectTo = loginMode === 'staff' ? '/staff-dashboard' : (searchParams.get('redirect') || '/dashboard');
        router.push(redirectTo);
      }
    } catch (error) {
      console.error("Login Page Error:", error);
      setError('An unexpected error occurred during login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-black rounded-full flex items-center justify-center">
          <span className="text-white text-2xl font-bold">FF</span>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to Fresh Face</h2>
        <p className="mt-2 text-sm text-gray-600">Salon Management System</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setLoginMode('admin')}
          className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${loginMode === 'admin' ? 'bg-white shadow text-black' : 'text-gray-600'}`}
        >
          Admin / Manager
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('staff')}
          className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${loginMode === 'staff' ? 'bg-white shadow text-black' : 'text-gray-600'}`}
        >
          Staff
        </button>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4 rounded-md">
          <div>
            <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">Salon ID</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><Building className="h-5 w-5 text-gray-400"/></div>
              <input
                id="subdomain" name="subdomain" type="text" required
                autoCapitalize="none" value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., admin"
              />
            </div>
          </div>
          
          {loginMode === 'admin' ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><User className="h-5 w-5 text-gray-400"/></div>
                <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your email"/>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="staffIdNumber" className="block text-sm font-medium text-gray-700">Staff ID Number</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><User className="h-5 w-5 text-gray-400"/></div>
                <input id="staffIdNumber" name="staffIdNumber" type="text" required value={staffIdNumber} onChange={(e) => setStaffIdNumber(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your Staff ID"/>
              </div>
            </div>
          )}
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><KeyRound className="h-5 w-5 text-gray-400"/></div>
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your password"/>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-50">
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an admin account?{' '}
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">Sign up here</Link>
          </p>
        </div>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
        <p className="text-xs text-gray-600">
          Email: superadmin@freshface.com | Password: SuperAdmin123!
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}