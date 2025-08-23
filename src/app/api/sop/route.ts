import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

/**
 * GET all SOPs for a tenant.
 * - If the user is a Super Admin (*) or has the 'sop:manage' permission, they see all SOPs.
 * - Otherwise, users only see the SOPs assigned to their specific role.
 */
export async function GET(req: NextRequest) {
    console.log("--- [GET /api/sop] API Route Hit ---");

    try {
        const session = await getServerSession(authOptions);
        
        // First, check for basic read permission.
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
        
        const userPermissions = session.user.role?.permissions || [];
        
        // Start with a base query that always filters by the user's tenant.
        const query: any = { tenantId };

        // --- THE FIX ---
        // Check if the user has the specific permission to manage SOPs.
        const canManageSops = hasPermission(userPermissions, PERMISSIONS.SOP_MANAGE);
        
        // Only apply the role-based filter if the user is NOT a super-admin 
        // AND does NOT have the 'sop:manage' permission.
        if (!userPermissions.includes('*') && !canManageSops) {
          query.roles = { $in: [session.user.role.id] };
        }
        // --- END OF FIX ---
        
        console.log("[GET /api/sop] Executing Database Query:", query);

        // Execute the final query, populating role names for the UI.
        const sops = await Sop.find(query)
          .populate('roles', 'displayName _id')
          .sort({ createdAt: -1 });

        console.log(`[GET /api/sop] Found ${sops.length} SOPs.`);

        return NextResponse.json(sops);

    } catch (error: any) {
        console.error("[GET /api/sop] An error occurred:", error);
        return NextResponse.json({ message: "An internal server error occurred.", error: error.message }, { status: 500 });
    }
}


/**
 * POST: Create a new SOP.
 * Only users with the 'sop:manage' permission can create SOPs.
 */
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
        // Create a new SOP, securely injecting server-side data like tenantId and createdBy
        const newSop = new Sop({ 
            ...body, 
            tenantId, 
            createdBy: session.user.id 
        });
        await newSop.save();
        return NextResponse.json(newSop, { status: 201 });
    } catch (error: any) {
        console.error("SOP Creation Error:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}