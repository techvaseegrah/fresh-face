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
 */
async function AdminStoreSelector() {
  await connectToDatabase();
  
  const allStores = await Tenant.find({}).select('_id name').lean();

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Platform Administrator View
        </h1>
        <p className="text-gray-600 text-base sm:text-lg">
          Please select a store to view its sales report.
        </p>
      </div>
      
      {allStores.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {allStores.map(store => (
            <Link 
              key={store._id.toString()}
              href={`/sales-report/${store._id.toString()}`}
              className="block p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-green-300 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg text-gray-800 group-hover:text-green-600 transition-colors truncate">
                    {store.name}
                  </h3>
                  <p className="text-sm font-medium text-green-600 group-hover:text-green-700 mt-2">
                    View Report →
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Stores Found</h3>
          <p className="text-gray-600">No stores have been created on the platform yet.</p>
        </div>
      )}
    </div>
  );
}

export default async function SalesReportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/api/auth/signin'); // Or your login page
  }

  // Check if user is Platform Administrator
  const isPlatformAdmin = session.user.name === 'Platform Administrator';

  return (
    <div className="space-y-6">
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