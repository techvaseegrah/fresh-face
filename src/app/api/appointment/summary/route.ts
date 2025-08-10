import { NextRequest, NextResponse } from 'next/server'; // 1. Import NextRequest
import dbConnect from '@/lib/dbConnect';
import Appointment from '@/models/Appointment';
import { getTenantIdOrBail } from '@/lib/tenant'; // 2. Import your helper
import mongoose from 'mongoose'; // 3. Import mongoose for ObjectId conversion

export async function GET(req: NextRequest) { // 4. Add 'req' to the function signature
  try {
    await dbConnect();

    // 5. Get the Tenant ID or fail early
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
      // If the helper returns a response, it means the tenant ID was missing.
      // We return that response immediately.
      return tenantId;
    }

    const dailyCounts = await Appointment.aggregate([
      {
        // 6. **THE FIX**: Add a $match stage as the FIRST step.
        // This filters for documents belonging ONLY to the current tenant.
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId)
        }
      },
      {
        // Stage 2: Group the filtered documents by date (this logic is unchanged)
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$appointmentDateTime" }
          },
          count: { $sum: 1 } 
        }
      },
      {
        // Stage 3: Sort the results (unchanged)
        $sort: { _id: -1 }
      }
    ]);

    // The rest of your logic for transforming the data is perfect and requires no changes.
    const countsMap = dailyCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({ success: true, counts: countsMap });

  } catch (error) {
    console.error("Failed to fetch appointment summary:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}