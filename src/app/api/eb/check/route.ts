// /app/api/eb/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import EBReading from '@/models/ebReadings';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdOrBail(request);
        if (tenantId instanceof NextResponse) return tenantId;

        const session = await getServerSession(authOptions);
        if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD)) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const dateString = searchParams.get('date');
        const meterIdentifier = searchParams.get('meterIdentifier');

        if (!dateString || !meterIdentifier) {
            return NextResponse.json({ success: false, message: 'Date and meter identifier are required' }, { status: 400 });
        }

        const recordDate = new Date(dateString);
        recordDate.setUTCHours(0, 0, 0, 0);

        await connectToDatabase();
        
        const existingReading = await EBReading.findOne({
            date: recordDate,
            tenantId: tenantId,
            meterIdentifier: meterIdentifier
        }).lean();

        return NextResponse.json({ success: true, exists: !!existingReading });

    } catch (error) {
        console.error('Error checking EB reading:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}