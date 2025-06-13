'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/dashboard', // Optional: Add a dashboard link if you have one
      label: 'Dashboard',
      icon: ( // Replace with your actual Dashboard SVG or remove if not needed
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      href: '/appointment',
      label: 'Appointments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      href: '/crm', // Your new CRM link
      label: 'CRM',
      icon: ( // Example CRM/Customers Icon (replace with a better one if you have it)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a3.004 3.004 0 01-2.732 0M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 0c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )
    },
   
    // Add other navigation items here if needed
  ];

  return (
    <div className="w-64 h-screen bg-white text-black fixed left-0 top-0 shadow-lg"> {/* Changed background, added shadow */}
      <div className="p-6">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">
            FF {/* Placeholder for Logo Icon/Text */}
          </div>
          <h1 className="text-xl font-semibold text-gray-800">FF Project</h1> {/* Darker text for brand */}
        </div>

        {/* Navigation */}
        <nav className="space-y-1"> {/* Reduced space-y for tighter packing */}
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-gray-700 ${ // Base text color
                pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/') // Active state
                  ? 'bg-gray-100 text-black font-medium' // Active state style
                  : 'hover:bg-gray-50 hover:text-black' // Hover state style
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200"> {/* Lighter border */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">
            {/* You can put user initials here, e.g., 'O' for Owner */}
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
          </div>
          <div>
            <div className="font-medium text-gray-800">Owner</div>
            <div className="text-sm text-gray-500">Admin</div> {/* Lighter text for role */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;