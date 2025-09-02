import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PackageTemplate, { IPackageTemplate } from '@/models/PackageTemplate';

// --- Best Practice: Import models that might be used for population in the future ---
import '@/models/ServiceItem';
import '@/models/Product';
// -----------------------------------------------------------------------------------


interface Params {
  params: { templateId: string };
}

/**
 * @method GET
 * @description Retrieves a single package template by its ID.
 * @permission read:packages
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(params.templateId)) {
        return NextResponse.json({ message: 'Invalid template ID format' }, { status: 400 });
    }

    await dbConnect();

    const template = await PackageTemplate.findOne({ _id: params.templateId, tenantId }).lean();

    if (!template) {
      return NextResponse.json({ message: 'Package template not found' }, { status: 404 });
    }

    return NextResponse.json(template, { status: 200 });
  } catch (error: any) {
    console.error(`Error fetching package template ${params.templateId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * @method PUT
 * @description Updates an existing package template.
 * @permission manage:packages
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId ) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    
    if (!mongoose.Types.ObjectId.isValid(params.templateId)) {
        return NextResponse.json({ message: 'Invalid template ID format' }, { status: 400 });
    }

    const body: Partial<IPackageTemplate> = await request.json();

    // Security: Prevent tenantId from being updated via the request body.
    delete (body as any).tenantId;

    await dbConnect();

    const updatedTemplate = await PackageTemplate.findOneAndUpdate(
      { _id: params.templateId, tenantId },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedTemplate) {
      return NextResponse.json({ message: 'Package template not found or you do not have permission to edit it' }, { status: 404 });
    }

    return NextResponse.json(updatedTemplate, { status: 200 });
  } catch (error: any) {
    console.error(`Error updating package template ${params.templateId}:`, error);
    if (error.name === 'ValidationError') {
        return NextResponse.json({ message: "Validation Error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * @method DELETE
 * @description Deactivates a package template (soft delete).
 * @permission manage:packages
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId ) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(params.templateId)) {
        return NextResponse.json({ message: 'Invalid template ID format' }, { status: 400 });
    }
    
    await dbConnect();
    
    // Perform a soft delete by setting isActive to false.
    const deactivatedTemplate = await PackageTemplate.findOneAndUpdate(
      { _id: params.templateId, tenantId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!deactivatedTemplate) {
      return NextResponse.json({ message: 'Package template not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Package template deactivated successfully' }, { status: 200 });
  } catch (error: any) {
    console.error(`Error deactivating package template ${params.templateId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}