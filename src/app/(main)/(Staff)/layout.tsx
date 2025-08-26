'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    LayoutDashboard, LogOut, Loader2, PlusCircle, CalendarPlus, 
    CalendarCheck, BarChart2, IndianRupee, Wallet, Clock, 
    Briefcase
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const NavLink = ({ href, icon, children }: { href: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    
    return (
        <Link 
            href={href}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive 
                ? 'bg-indigo-600 text-white font-semibold' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
            {icon}
            <span>{children}</span>
        </Link>
    );
};

export default function StaffDashboardLayout({ children }: { children: React.ReactNode; }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  // --- FIX: Removed state for modal ---
  // const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && session.user.role.name !== 'staff')) {
      router.replace('/login');
    }
  }, [status, session, router]);

  if (status === 'loading' || !session || session.user.role.name !== 'staff') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer theme="colored" position="top-right" />
      {/* --- FIX: Removed modal component --- */}

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
          
          <nav className="flex-1 p-4 space-y-2">
            <NavLink href="/staff-dashboard" icon={<LayoutDashboard size={20} />}>Dashboard</NavLink>
            <NavLink href="/my-appointments" icon={<Briefcase size={20} />}>My Appointments</NavLink>
            <NavLink href="/attendance" icon={<CalendarCheck size={20} />}>Attendance</NavLink>
            <NavLink href="/advance" icon={<PlusCircle size={20}/>}>Request Advance</NavLink>
            <NavLink href="/performance" icon={<BarChart2 size={20} />}>Performance</NavLink>
            <NavLink href="/incentives" icon={<IndianRupee size={20} />}>Incentives</NavLink>
            <NavLink href="/payouts" icon={<Wallet size={20} />}>Request Incentive Payout</NavLink>
            <NavLink href="/my-shifts" icon={<Clock size={20} />}>My Shifts</NavLink>
            <hr className="my-2"/>
            {/* --- FIX START: Replaced button with a NavLink to the leave page --- */}
            <NavLink href="/leave" icon={<CalendarPlus size={20} />}>
                Request Leave
            </NavLink>
            {/* --- FIX END --- */}
          </nav>
          
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
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600"
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