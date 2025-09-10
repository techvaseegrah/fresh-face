import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import ImportJob from '@/models/ImportJob';
import connectToDatabase from '@/lib/mongodb';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_IMPORT)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) return tenantId;

  try {
    const { jobId } = params;
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
        return NextResponse.json({ message: 'Invalid Job ID format.' }, { status: 400 });
    }
    
    await connectToDatabase();

    const job = await ImportJob.findOne({ _id: jobId, tenantId });

    if (!job) {
      return NextResponse.json({ message: 'Job not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });

  } catch (error) {
    console.error('Error fetching import job status:', error);
    return NextResponse.json({ message: 'Server error.' }, { status: 500 });
  }
}