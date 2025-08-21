import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Make sure you have created this component as per the previous instructions
import TenantSalesReport from '@/components/reports/TenantSalesReport'; 

// Make sure you are importing your Tenant model and DB connection
import connectToDatabase from '@/lib/mongodb';
import Tenant from '@/models/Tenant';

/**
 * This component is for the Platform Administrator.
 * It fetches and displays a list of all stores (tenants).
 *
 * (This component's code is unchanged)
 */
async function AdminStoreSelector() {
  await connectToDatabase();
  
  const allStores = await Tenant.find({}).select('_id name').lean();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Platform Administrator View</h1>
      <p className="text-gray-600 mb-6">Please select a store to view its sales report.</p>
      
      {allStores.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allStores.map(store => (
            <Link 
              key={store._id.toString()}
              href={`/sales-report/${store._id.toString()}`}
              className="block p-4 bg-white rounded-lg shadow-md hover:bg-gray-50 hover:shadow-lg transition-all duration-200"
            >
              <h3 className="font-semibold text-lg text-gray-800">{store.name}</h3>
              <p className="text-sm text-blue-600 font-medium mt-1">View Report &rarr;</p>
            </Link>
          ))}
        </div>
      ) : (
        <p>No stores have been created on the platform yet.</p>
      )}
    </div>
  );
}

/**
 * This is the main page component that now uses a more robust check
 * to determine which view to show.
 */
export default async function SalesReportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/api/auth/signin'); // Or your login page
  }

  // --- ⭐️ NEW AND IMPROVED ROLE CHECK ⭐️ ---
  // We will now check the user's name directly. This is much more reliable.
  // Based on your screenshot, the admin's name is "Platform Administrator".
  // Note: If you have a `role` property in your session (e.g., session.user.role === 'admin'), that is even better!
  const isPlatformAdmin = session.user.name === 'Platform Administrator';

  return (
    <div className="p-8 bg-gray-50 min-h-full">
      {isPlatformAdmin ? (
        // If the check passes, show the Admin view to select a store.
        <AdminStoreSelector />
      ) : (
        // Otherwise, show the regular tenant view.
        <TenantSalesReport />
      )}
    </div>
  );
}