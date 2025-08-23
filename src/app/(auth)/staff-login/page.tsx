// /app/(auth)/staff-login/page.tsx

'use client';

import { useState, useEffect, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LockKeyhole, UserSquare } from 'lucide-react';

export default function StaffLoginPage() {
  const [tenantId, setTenantId] = useState('');
  const [staffIdNumber, setStaffIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getTenantIdFromSubdomain = async () => {
      const subdomain = window.location.hostname.split('.')[0];
      if (!subdomain || subdomain === 'localhost' || subdomain === 'www') {
        toast.error("Could not identify the salon from the URL.", { autoClose: false });
        return;
      }
      try {
        // This API route must exist to translate a subdomain (e.g., "demo") to a tenantId
        const res = await fetch(`/api/tenant/by-subdomain?subdomain=${subdomain}`);
        const data = await res.json();
        if (data.success && data.tenantId) {
          setTenantId(data.tenantId);
        } else {
          toast.error("This Salon ID is invalid or not registered.", { autoClose: false });
        }
      } catch (error) {
        toast.error("Error verifying salon. Please check your connection.", { autoClose: false });
      }
    };
    getTenantIdFromSubdomain();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!tenantId) {
        toast.error("Cannot log in: Salon ID is not verified. Please check the URL.");
        setIsLoading(false);
        return;
    }

    const result = await signIn('staff-credentials', {
      staffIdNumber,
      password,
      tenantId, // This is crucial for the authorize function
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.ok) {
      toast.success("Login successful! Redirecting...");
      router.push('/staff-dashboard'); 
    }
  };

  return (
    <>
      <ToastContainer theme="colored" />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 p-10 bg-white shadow-xl rounded-2xl border border-gray-200">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Staff Portal Login</h2>
            <p className="mt-2 text-sm text-gray-600">Access your personal dashboard</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="staffIdNumber" className="block text-sm font-medium text-gray-700">Staff ID</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserSquare className="h-5 w-5 text-gray-400" />
                </div>
                <input id="staffIdNumber" type="text" value={staffIdNumber} onChange={e => setStaffIdNumber(e.target.value)} required className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <LockKeyhole className="h-5 w-5 text-gray-400" />
                </div>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            </div>
            <button type="submit" disabled={isLoading || !tenantId} className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}