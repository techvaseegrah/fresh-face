import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServiceItem from '@/models/ServiceItem';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ===================================================================================
//  GET: Handler to fetch all data needed for the staff booking form
// ===================================================================================
export async function GET(req: NextRequest) {
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  // Security Check: Ensure user is authenticated and is a staff member
  const session = await getServerSession(authOptions);
  if (!session || session.user.role.name !== 'staff') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    const serviceQuery = { tenantId: tenantId };
    const staffQuery = { tenantId: tenantId, status: 'active' };

    // Fetch both services and assignable staff in parallel for efficiency
    const [services, staff] = await Promise.all([
        ServiceItem.find(serviceQuery)
            // ✅ CORRECTED: Added 'membershipRate' to the selected fields
            .select('name price duration membershipRate') 
            .sort({ name: 1 })
            .lean(),
        
        Staff.find(staffQuery)
            .select('_id name')
            .sort({ name: 'asc' })
            .lean()
    ]);

    return NextResponse.json({ 
        success: true, 
        data: {
            services,
            staff
        }
    });

  } catch (error: any) {
    console.error("API Error fetching booking data for staff:", error);
    return NextResponse.json({ success: false, message: "Failed to load booking data." }, { status: 500 });
  }
}