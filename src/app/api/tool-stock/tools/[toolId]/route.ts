import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tool from '@/models/Tool';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

interface Params {
  params: { toolId: string };
}

// PUT: Update an existing tool's details
export async function PUT(request: NextRequest, { params }: Params) {
  const { toolId } = params;
  if (!mongoose.Types.ObjectId.isValid(toolId)) {
    return NextResponse.json({ message: 'Invalid Tool ID' }, { status: 400 });
  }

  await dbConnect();

  const tenantIdOrBail = getTenantIdOrBail(request);
  if (tenantIdOrBail instanceof NextResponse) {
    return tenantIdOrBail;
  }
  const tenantId = tenantIdOrBail;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    // LATER: Add permission check for 'TOOL_STOCK_MANAGE'

    const body = await request.json();
    const { name, category, maintenanceDueDate, isActive } = body;

    const updatedTool = await Tool.findOneAndUpdate(
      { _id: toolId, tenantId },
      { name, category, maintenanceDueDate, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedTool) {
      return NextResponse.json({ message: 'Tool not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(updatedTool, { status: 200 });
  } catch (error: any) {
    console.error(`Error updating tool ${toolId}:`, error);
    if (error.code === 11000) {
        return NextResponse.json({ message: `A tool with the name "${error.keyValue.name}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}