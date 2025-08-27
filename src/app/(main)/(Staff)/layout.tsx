'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    LayoutDashboard, LogOut, Loader2, PlusCircle, CalendarPlus, 
    CalendarCheck, BarChart2, IndianRupee, Wallet, Clock, 
    Briefcase, Menu, X 
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const NavLink = ({ href, icon, children, onClick }: { href: string, icon: React.ReactNode, children: React.ReactNode, onClick?: () => void }) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    
    return (
        <Link 
            href={href}
            onClick={onClick} 
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive 
                ? 'bg-black text-white font-semibold' 
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false); 

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && session.user.role.name !== 'staff')) {
      router.replace('/login');
    }
  }, [status, session, router]);

  // Effect to prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'; 
    } else {
      document.body.style.overflow = ''; 
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

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

      {/* Mobile Header (fixed, only visible when sidebar is closed on mobile) */}
      <div className="md:hidden fixed top-0 left-0 w-full bg-white shadow-md px-4 flex items-center justify-between z-50 h-12"> 
          <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-sm">FF</div>
              <h2 className="text-md font-bold text-black">Fresh Face</h2>
          </div>
          <button onClick={toggleMobileMenu} className="text-gray-700 p-2"> 
              <Menu size={20} /> 
          </button>
      </div>

      {/* Mobile Overlay: Appears when the mobile menu is open, acts as a backdrop */}
      {isMobileMenuOpen && (
          <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={closeMobileMenu} 
          ></div>
      )}

      {/* Main Layout Container (Desktop layout remains unchanged, mobile adjustments below) */}
      <div className="absolute inset-0 flex bg-gray-50">
        <aside 
            className={`
                w-64 bg-white shadow-md flex-col 
                transition-transform duration-300 ease-in-out
                // Mobile-specific styles (default)
                fixed inset-y-0 left-0 z-50 flex 
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                // Desktop-specific overrides (ensures it behaves as a normal sidebar)
                md:relative md:flex md:translate-x-0 md:flex-shrink-0 md:flex-grow-0 md:z-auto
            `}
        >
          {/* Sidebar's Internal Header (Always visible within the sidebar, acts as header for mobile menu) */}
          <div className="p-4 border-b flex items-center justify-between"> 
              <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">FF</div>
                  <div>
                      <h2 className="text-md font-bold text-black">Fresh Face</h2>
                      <p className="text-xs text-gray-500">Salon Management</p>
                  </div>
              </div>
              {/* Close button for the sidebar (only visible on mobile, not md:hidden) */}
              <button onClick={closeMobileMenu} className="md:hidden text-gray-700 p-2"> 
                <X size={24} /> 
              </button>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavLink href="/staff-dashboard" icon={<LayoutDashboard size={20} />} onClick={closeMobileMenu}>Dashboard</NavLink>
            <NavLink href="/my-appointments" icon={<Briefcase size={20} />} onClick={closeMobileMenu}>My Appointments</NavLink>
            <NavLink href="/attendance" icon={<CalendarCheck size={20} />} onClick={closeMobileMenu}>Attendance</NavLink>
            <NavLink href="/advance" icon={<PlusCircle size={20}/>} onClick={closeMobileMenu}>Request Advance</NavLink>
            <NavLink href="/performance" icon={<BarChart2 size={20} />} onClick={closeMobileMenu}>Performance</NavLink>
            <NavLink href="/incentives" icon={<IndianRupee size={20} />} onClick={closeMobileMenu}>Incentives</NavLink>
            <NavLink href="/payouts" icon={<Wallet size={20} />} onClick={closeMobileMenu}>Request Incentive Payout</NavLink>
            <NavLink href="/my-shifts" icon={<Clock size={20} />} onClick={closeMobileMenu}>My Shifts</NavLink>
            <hr className="my-2"/>
            <NavLink href="/leave" icon={<CalendarPlus size={20} />} onClick={closeMobileMenu}>
                Request Leave
            </NavLink>
          </nav>
          
          {/* Fixed footer section with proper visibility */}
          <div className="p-4 border-t bg-white mt-auto flex-shrink-0">
              <div className="flex items-center gap-3 w-full p-2 rounded-lg mb-2">
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-sm">
                      {session?.user.name?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{session?.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session?.user.role.displayName}</p>
                  </div>
              </div>
              <button
                  onClick={() => { signOut({ callbackUrl: '/login' }); closeMobileMenu(); }} 
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
              >
                  <LogOut size={20} />
                  <span>Sign Out</span>
              </button>
          </div>
        </aside>

        {/* Main Content Area */}
        {/* pt-[56px] for mobile to offset the fixed mobile header when the sidebar is closed. */}
        {/* md:pt-0 ensures no extra top padding on desktop */}
        <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto pt-[56px] md:pt-0"> 
          {children}
        </main>
      </div>
    </>
  );
}