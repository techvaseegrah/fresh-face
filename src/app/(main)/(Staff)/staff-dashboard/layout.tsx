'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { 
    LayoutDashboard, LogOut, Loader2, PlusCircle, CalendarPlus, 
    CalendarCheck, BarChart2, IndianRupee, Wallet, Clock 
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- (Your Modal components, like RequestLeaveModal, should remain here) ---

export default function StaffDashboardLayout({ children }: { children: React.ReactNode; }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && session.user.role.name !== 'staff')) {
      router.replace('/login');
    }
  }, [status, session, router]);

  if (status === 'loading' || (status === 'authenticated' && session.user.role.name !== 'staff')) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer theme="colored" position="top-right" />
      {/* <RequestAdvanceModal ... /> */}
      {/* <RequestLeaveModal ... /> */}

      <div className="absolute inset-0 flex bg-gray-50">
        <aside className="w-64 bg-white shadow-md flex flex-col">
          <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">FF</div>
                  <div>
                      <h2 className="text-md font-bold text-black">Fresh Face</h2>
                      <p className="text-xs text-gray-500">Salon Management</p>
                  </div>
              </div>
          </div>
          
          {/* --- Static Navigation, no active state --- */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/staff-dashboard" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>
            <Link href="/attendance" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <CalendarCheck size={20} />
              <span>Attendance</span>
            </Link>
            <Link href="/performance" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <BarChart2 size={20} />
              <span>Performance</span>
            </Link>
            <Link href="/incentives" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <IndianRupee size={20} />
              <span>Incentives</span>
            </Link>
            <Link href="/payouts" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <Wallet size={20} />
              <span>Payouts</span>
            </Link>
            <Link href="/shifts" className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <Clock size={20} />
              <span>My Shifts</span>
            </Link>
            <hr className="my-2"/>
            <button onClick={() => setIsLeaveModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-left">
              <CalendarPlus size={20}/> 
              <span>Request Leave</span>
            </button>
            <button onClick={() => setIsAdvanceModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-left">
              <PlusCircle size={20}/>
              <span>Request Advance</span>
            </button>
          </nav>
          
          {/* --- THE FIX: Restored the missing User Profile & Sign Out section --- */}
          <div className="p-4 border-t">
              <div className="flex items-center gap-3 w-full p-2 rounded-lg mb-2">
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center font-bold">
                      {session?.user.name?.charAt(0)}
                  </div>
                  <div>
                      <p className="text-sm font-semibold">{session?.user.name}</p>
                      <p className="text-xs text-gray-500">{session?.user.role.displayName}</p>
                  </div>
              </div>
              <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Sign Out"
              >
                  <LogOut size={20} />
                  <span>Sign Out</span>
              </button>
          </div>
        </aside>
        <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}