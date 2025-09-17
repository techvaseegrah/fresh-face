// /app/(auth)/login/page.tsx - FINAL COMPLETE VERSION
'use client';

import { useState, useEffect, Suspense, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Building, User, AtSign, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

// Define animation variants for cleaner code
const inputVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const errorVariants = {
    hidden: { opacity: 0, y: -10, height: 0 },
    visible: { opacity: 1, y: 0, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, height: 0, transition: { duration: 0.2 } },
};

function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialMode = searchParams.get('mode') === 'staff' ? 'staff' : 'admin';
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>(initialMode);

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
      if (err === 'CredentialsSignin') {
        setError('Invalid credentials provided. Please check your details and try again.');
      } else {
        setError('Please use your salon-specific URL to access this page.');
      }
    }
  }, [searchParams]);

  const handleModeChange = (mode: 'admin' | 'staff') => {
    setLoginMode(mode);
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('mode', mode);
    router.replace(currentUrl.toString(), { scroll: false });
  };

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
      {/* --- FINAL FIX START --- */}
      {/* This is the robust, bug-free implementation of the animated slider. */}
      <div className="flex w-full items-center justify-center rounded-xl bg-slate-200 p-1">
        {/* Admin Button */}
        <button
          onClick={() => handleModeChange('admin')}
          className={`relative w-full rounded-lg px-4 py-2 text-sm transition-colors ${
            loginMode === 'admin' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {loginMode === 'admin' && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 rounded-lg bg-white shadow-md"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10 font-semibold">Admin / Manager</span>
        </button>
        
        {/* The Separator Line */}
        <div className="h-5 w-px bg-slate-300 mx-1" />

        {/* Staff Button */}
        <button
          onClick={() => handleModeChange('staff')}
          className={`relative w-full rounded-lg px-4 py-2 text-sm transition-colors ${
            loginMode === 'staff' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {loginMode === 'staff' && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 rounded-lg bg-white shadow-md"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10 font-semibold">Staff</span>
        </button>
      </div>
      {/* --- FINAL FIX END --- */}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <AnimatePresence>
          {error && (
            <motion.div
              variants={errorVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
        
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

          <AnimatePresence mode="wait">
            {loginMode === 'admin' ? (
              <motion.div key="admin-email" variants={inputVariants} initial="hidden" animate="visible" exit="exit">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><AtSign className="h-5 w-5 text-gray-400" /></div>
                  <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your email"/>
                </div>
              </motion.div>
            ) : (
              <motion.div key="staff-id" variants={inputVariants} initial="hidden" animate="visible" exit="exit">
                <label htmlFor="staffIdNumber" className="block text-sm font-medium text-gray-700">Staff ID Number</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-gray-400" /></div>
                  <input id="staffIdNumber" name="staffIdNumber" type="text" required value={staffIdNumber} onChange={(e) => setStaffIdNumber(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your Staff ID"/>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={isLoading} 
            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </motion.button>
        </div>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex justify-center items-center bg-gray-100 overflow-hidden p-4">
      
      {/* Abstract Background Shapes */}
      <div className="absolute inset-0 w-full h-full z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-violet-300 to-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-gradient-to-r from-sky-300 to-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* The Login Form Content (sits on top of the background) */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <Image
                src="/salon-capp-logo.png"
                alt="Salon Capp Logo"
                width={150} // You can adjust the size here
                height={200} // You can adjust the size here
                priority // Helps load the logo faster
              />
            </div>
            <h2 className="mt- text-2xl sm:text-3xl font-extrabold text-gray-900">
              Sign in to Salon Capp
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Salon Management System
            </p>
          </div>

          {/* Glassmorphism Card */}
          <div className="bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl rounded-2xl border border-white/20">
            <Suspense fallback={<div className="text-center text-gray-500">Loading Form...</div>}>
              <UnifiedLoginForm />
            </Suspense>
          </div>

          <div className="p-4 bg-white/70 backdrop-blur-xl rounded-2xl text-center sm:text-left shadow-lg border border-white/20">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Demo Credentials:</h3>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Email:</span> superadmin@freshface.com
              <br className="sm:hidden"/> 
              <span className="sm:ml-4 font-semibold">Password:</span> SuperAdmin123!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}