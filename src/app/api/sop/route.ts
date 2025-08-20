import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import { PERMISSIONS, hasPermission } from '@/lib/permissions'; // Use your file path

// GET all SOPs assigned to the logged-in user's role
export async function GET(req: NextRequest) {
    console.log("--- [GET /api/sop] API Route Hit ---");

    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_READ)) {
            console.log("[GET /api/sop] Permission denied.");
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const tenantId = getTenantIdOrBail(req);
        if (tenantId instanceof NextResponse) {
            console.log("[GET /api/sop] Tenant ID missing from request.");
            return tenantId;
        }

        await dbConnect();
        
        // --- THIS IS THE FIX ---
        const userPermissions = session.user.role?.permissions || [];
        
        // 1. Start with a base query that always filters by tenant.
        const query: any = { tenantId };

        // 2. Check if the user is a super-admin (has the '*' wildcard).
        //    If they are NOT, then apply the role filter.
        if (!userPermissions.includes('*')) {
          query.roles = { $in: [session.user.role.id] };
        }
        
        console.log("[GET /api/sop] Executing Database Query:", query);

        // 3. Execute the final query.
        const sops = await Sop.find(query)
          .populate('roles', 'displayName _id')
          .sort({ createdAt: -1 });

        console.log(`[GET /api/sop] Found ${sops.length} SOPs.`);

        return NextResponse.json(sops);

    } catch (error) {
        console.error("[GET /api/sop] An error occurred:", error);
        return NextResponse.json({ message: "An internal server error occurred.", error: error.message }, { status: 500 });
    }
}


// POST: Create a new SOP
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_MANAGE)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await dbConnect();
    
    try {
        const body = await req.json();
        const newSop = new Sop({ 
            ...body, 
            tenantId, 
            createdBy: session.user.id 
        });
        await newSop.save();
        return NextResponse.json(newSop, { status: 201 });
    } catch (error) {
        console.error("SOP Creation Error:", error);
        return NextResponse.json({ message: 'Server Error', error }, { status: 500 });
    }
}