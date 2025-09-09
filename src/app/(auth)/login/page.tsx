// /app/(auth)/login/page.tsx
'use client';

import { useState, useEffect, Suspense, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Building, User, AtSign, KeyRound } from 'lucide-react';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // --- CHANGE START ---
  // Read the initial login mode from the URL query parameter. Default to 'admin'.
  const initialMode = searchParams.get('mode') === 'staff' ? 'staff' : 'admin';
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>(initialMode);
  // --- CHANGE END ---

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
      // More specific error messages can be helpful
      if (err === 'CredentialsSignin') {
        setError('Invalid credentials provided. Please check your details and try again.');
      } else {
        setError('Please use your salon-specific URL to access this page.');
      }
    }
  }, [searchParams]);

  // --- CHANGE START ---
  // Function to handle changing the login mode and updating the URL
  const handleModeChange = (mode: 'admin' | 'staff') => {
    setLoginMode(mode);
    // Create a new URL object from the current window location
    const currentUrl = new URL(window.location.href);
    // Set the 'mode' query parameter
    currentUrl.searchParams.set('mode', mode);
    // Use router.replace to update the URL in the browser without a full page reload
    // and without adding a new entry to the browser's history.
    router.replace(currentUrl.toString(), { scroll: false });
  };
  // --- CHANGE END ---


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
      redirect: false, // This is correct, it prevents a full redirect on success
    };

    const result = await signIn(provider, credentials);

    if (result?.error) {
      // When signIn fails, next-auth often reloads the page with an error in the URL.
      // Our new logic will preserve the tab state.
      // We explicitly set the error state here for immediate feedback in case there's no reload.
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
        {/* --- CHANGE START --- */}
        {/* Update buttons to use the new handler function */}
        <button
          type="button"
          onClick={() => handleModeChange('admin')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${ loginMode === 'admin' ? 'bg-white shadow text-black' : 'text-gray-600' }`}
        >
          Admin / Manager
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('staff')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${ loginMode === 'staff' ? 'bg-white shadow text-black' : 'text-gray-600' }`}
        >
          Staff
        </button>
        {/* --- CHANGE END --- */}
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
          <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
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
      <div className="flex justify-center items-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            {/* --- UPDATED LOGO PATH TO /image.png --- */}
            <Image
              src="/image.png" // UPDATED: Correct path to your logo
              alt="Fresh Face Logo"
              width={100} // Keeps the logo clear at a high resolution
              height={100}
              className="mx-auto h-20 w-20 sm:h-24 sm:w-24" // Larger display size
              priority // Helps load the logo faster
            />
            <h2 className="mt-6 text-2xl sm:text-3xl font-extrabold text-gray-900">Sign in to Fresh Face</h2>
            <p className="mt-2 text-sm text-gray-600">Salon Management System</p>
          </div>

          <div className="bg-white p-6 sm:p-8 shadow-xl rounded-lg">
            <Suspense fallback={<div className="text-center text-gray-500">Loading Form...</div>}>
              <UnifiedLoginForm />
            </Suspense>
          </div>

          <div className="p-4 bg-gray-100 rounded-md text-center sm:text-left">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Email:</span> superadmin@freshface.com
              <br className="sm:hidden"/> 
              <span className="sm:ml-4 font-semibold">Password:</span> SuperAdmin123!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}