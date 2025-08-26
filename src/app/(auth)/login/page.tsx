// /app/(auth)/login/page.tsx - FINAL CORRECTED VERSION

'use client';

import { useState, useEffect, Suspense, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Building, User, AtSign, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>('admin');
  const [salonId, setSalonId] = useState('');
  const [email, setEmail] = useState('');
  const [staffIdNumber, setStaffIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isSubdomainDetected, setIsSubdomainDetected] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www') {
      const detectedSubdomain = parts[0];
      setSalonId(detectedSubdomain);
      setIsSubdomainDetected(true);
    }
    const err = searchParams.get('error');
    if (err) {
      setError('Please use your salon-specific URL to access this page.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const provider = loginMode === 'admin' ? 'credentials' : 'staff-credentials';
    const credentials = {
      subdomain: salonId,
      password,
      email: email,
      staffIdNumber: staffIdNumber,
      redirect: false,
    };

    const result = await signIn(provider, credentials);

    if (result?.error) {
      setError(result.error || `Invalid credentials for ${loginMode}.`);
      setIsLoading(false);
    } else if (result?.ok) {
      const redirectTo = loginMode === 'admin' 
        ? (searchParams.get('redirect') || '/dashboard') 
        : '/staff-dashboard';
      router.replace(redirectTo);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setLoginMode('admin')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${ loginMode === 'admin' ? 'bg-white shadow text-black' : 'text-gray-600' }`}
        >
          Admin / Manager
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('staff')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${ loginMode === 'staff' ? 'bg-white shadow text-black' : 'text-gray-600' }`}
        >
          Staff
        </button>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>)}
        <div className="space-y-4">
          <div>
            <label htmlFor="salonId" className="block text-sm font-medium text-gray-700">Salon ID</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Building className="h-5 w-5 text-gray-400" /></div>
              <input
                id="salonId" name="salonId" type="text" required
                value={salonId}
                onChange={(e) => setSalonId(e.target.value.toLowerCase().trim())}
                readOnly={isSubdomainDetected}
                className={`w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isSubdomainDetected ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="e.g., admin or glamour"
              />
            </div>
             {isSubdomainDetected && <p className="text-xs text-gray-500 mt-1">Salon ID is detected from the URL.</p>}
          </div>

          {loginMode === 'admin' ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative mt-1">
                 <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><AtSign className="h-5 w-5 text-gray-400" /></div>
                 <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your email"/>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="staffIdNumber" className="block text-sm font-medium text-gray-700">Staff ID Number</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-gray-400" /></div>
                <input id="staffIdNumber" name="staffIdNumber" type="text" required value={staffIdNumber} onChange={(e) => setStaffIdNumber(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your Staff ID"/>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><KeyRound className="h-5 w-5 text-gray-400" /></div>
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your password"/>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label={showPassword ? "Hide password" :"Show password"}>
                {showPassword ? (<EyeOff className="h-5 w-5 text-gray-500" />) : (<Eye className="h-5 w-5 text-gray-500" />)}
              </button>
            </div>
          </div>
        </div>
        <div>
          <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-50">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </>
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
          <Suspense fallback={<div>Loading...</div>}>
            <UnifiedLoginForm />
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
