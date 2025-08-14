// app/api/incentives/reset/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // Import the tenant ID helper

async function checkPermissions(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role?.permissions) {
    return { error: 'Authentication required.', status: 401 };
  }
  const userPermissions = session.user.role.permissions;
  if (!hasPermission(userPermissions, permission)) {
    return { error: 'You do not have permission to perform this action.', status: 403 };
  }
  return null; 
}

// This route handles POST requests to reset (delete) a daily sales record.
export async function POST(request: Request) {
    const permissionCheck = await checkPermissions(PERMISSIONS.STAFF_INCENTIVES_MANAGE);
  if (permissionCheck) {
    return NextResponse.json({ success: false, error: permissionCheck.error }, { status: permissionCheck.status });
  }
  try {
    await dbConnect();
    
    // --- Add Tenant ID Check ---
    const tenantId = getTenantIdOrBail(request as any); // Cast to any to match NextRequest type for now
    if (tenantId instanceof NextResponse) {
      return tenantId; // Return the error response if bail occurs
    }
    // --- End Tenant ID Check ---

    const body = await request.json();
    const { staffId, date } = body;

    // Validate that the required information was sent
    if (!staffId || !date) {
      return NextResponse.json({ message: 'Staff ID and date are required to reset data.' }, { status: 400 });
    }

    // Ensure the staff member exists and belongs to the current tenant
    // Modify Staff query to include tenantId
    const staffExists = await Staff.findOne({ _id: staffId, tenantId });
    if (!staffExists) {
        return NextResponse.json({ message: 'Staff not found or does not belong to your salon.' }, { status: 404 });
    }
    
    // ====================================================================
    // THE FIX IS HERE
    // Replace the old date logic with the reliable UTC parsing method.
    // ====================================================================
    const [year, month, day] = date.split('-').map(Number);
    // This creates a UTC date that will precisely match the record in the database.
    const targetDate = new Date(Date.UTC(year, month - 1, day));

    // Find and delete the specific daily sale record using the correct UTC date and tenantId
    // Modify DailySale query to include tenantId
    const deleteResult = await DailySale.deleteOne({ 
      staff: staffId, 
      date: targetDate,
      tenantId 
    });

    // If no document was deleted, it means none was found for that specific UTC date.
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ message: 'No data found for the selected day to reset.' }, { status: 404 });
    }

    // If we get here, the reset was successful.
    return NextResponse.json({ message: 'Daily data for the selected day has been reset successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives/reset Error:", error);
    return NextResponse.json({ message: 'An internal server error occurred while resetting data', error: error.message }, { status: 500 });
  }
}