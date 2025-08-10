import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShopSetting from '@/models/ShopSetting';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant'; // <-- Import the helper

// GET handler fetches settings AND positions for the CURRENT tenant
export async function GET(req: NextRequest) { // <-- Add req parameter
    try {
        await dbConnect();

        // 1. Get the Tenant ID or fail early
        const tenantId = getTenantIdOrBail(req);
        if (tenantId instanceof NextResponse) {
            return tenantId;
        }

        const [settings, positions] = await Promise.all([
            // 2. Find the settings document for THIS tenant
            ShopSetting.findOneAndUpdate(
                { tenantId: tenantId },
                { $setOnInsert: { tenantId: tenantId } }, // On creation, set the tenantId
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean(),
            // 3. Find distinct positions for THIS tenant
            Staff.distinct('position', { tenantId: tenantId }).exec()
        ]);
        
        const validPositions = positions.filter(p => p && typeof p === 'string' && p.trim() !== '');

        return NextResponse.json({ 
            success: true, 
            data: {
                settings,
                positions: validPositions
            }
        });
    } catch (error: any) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST handler saves settings for the CURRENT tenant
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        
        // 1. Get the Tenant ID or fail early
        const tenantId = getTenantIdOrBail(req);
        if (tenantId instanceof NextResponse) {
            return tenantId;
        }

        const payload = await req.json();
        
        // Security: Never let the client override the tenantId
        delete payload.tenantId;

        // 2. Find and update the settings document for THIS tenant
        const updatedSettings = await ShopSetting.findOneAndUpdate(
            { tenantId: tenantId },
            { $set: payload },
            { new: true, runValidators: true, upsert: true }
        );

        if (!updatedSettings) {
            // This should technically not be reachable due to upsert:true
            return NextResponse.json({ success: false, error: "Could not find or create settings for this tenant." }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updatedSettings });
    } catch (error: any) {
        console.error('Error saving settings:', error);
        if (error.name === 'ValidationError') {
            // Your validation error handling for duplicate positions within the array is good
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}