import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tool from '@/models/Tool';
import ToolLog, { ToolLogAction } from '@/models/ToolLog';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

// POST: Adjust the stock of a tool
export async function POST(request: NextRequest) {
  await dbConnect();

  const tenantIdOrBail = getTenantIdOrBail(request);
  if (tenantIdOrBail instanceof NextResponse) {
    return tenantIdOrBail;
  }
  const tenantId = tenantIdOrBail;

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // LATER: Add permission check for 'TOOL_STOCK_MANAGE'
  const userId = session.user.id;

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const body = await request.json();
    const { toolId, action, quantity, remarks } = body as {
      toolId: string;
      action: ToolLogAction;
      quantity: number;
      remarks?: string;
    };

    if (!mongoose.Types.ObjectId.isValid(toolId) || !action || !quantity || quantity <= 0) {
      return NextResponse.json({ message: 'Invalid input data' }, { status: 400 });
    }
    
    const validActions: ToolLogAction[] = ['ADDITION', 'DAMAGE', 'LOSS', 'DELETION'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ message: 'Invalid action type' }, { status: 400 });
    }

    const tool = await Tool.findOne({ _id: toolId, tenantId }).session(dbSession);
    if (!tool) {
      throw new Error('Tool not found');
    }

    const stockBefore = tool.currentStock;
    let stockAfter: number;
    let quantityChange: number;

    if (action === 'ADDITION') {
      stockAfter = stockBefore + quantity;
      quantityChange = +quantity;
    } else { // DAMAGE, LOSS, DELETION
      stockAfter = stockBefore - quantity;
      quantityChange = -quantity;
      if (stockAfter < 0) {
        throw new Error('Stock cannot go below zero');
      }
    }
    
    // Step 1: Update the tool's current stock
    tool.currentStock = stockAfter;
    await tool.save({ session: dbSession });
    
    // Step 2: Create a log entry for the adjustment
    const newLog = new ToolLog({
      tenantId,
      toolId,
      userId,
      action,
      quantityChange,
      stockBefore,
      stockAfter,
      remarks,
    });
    await newLog.save({ session: dbSession });

    await dbSession.commitTransaction();

    return NextResponse.json({ message: 'Stock adjusted successfully', tool }, { status: 200 });

  } catch (error: any) {
    await dbSession.abortTransaction();
    console.error('Error adjusting tool stock:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}