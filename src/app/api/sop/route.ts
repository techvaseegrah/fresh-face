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
 * 
 * This endpoint is compatible with the new detailed checklist item structure.
 */
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
        
        const userPermissions = session.user.role?.permissions || [];
        
        const query: any = { tenantId };

        const canManageSops = hasPermission(userPermissions, PERMISSIONS.SOP_MANAGE);
        
        // Only apply the role-based filter if the user is not a super-admin and does not have manage permissions.
        if (!userPermissions.includes('*') && !canManageSops) {
          query.roles = { $in: [session.user.role.id] };
        }
        
        console.log("[GET /api/sop] Executing Database Query:", query);

        // This query will now automatically return the new, complex `checklistItems` array.
        const sops = await Sop.find(query)
          .populate('roles', 'displayName _id')
          .sort({ createdAt: -1 })
          .lean(); // Using .lean() for performance is a great practice.

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
 * This endpoint is compatible with the new detailed checklist item structure,
 * as it passes the request body directly to the Mongoose model for validation.
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
        
        // The Mongoose 'Sop' model will validate the new, complex `checklistItems` structure from the body.
        const newSop = new Sop({ 
            ...body, 
            tenantId, 
            createdBy: session.user.id 
        });
        
        await newSop.save();
        return NextResponse.json(newSop, { status: 201 });
    } catch (error: any) {
        console.error("SOP Creation Error:", error);
        // If the frontend sends malformed data, the error from newSop.save() will be caught here.
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}