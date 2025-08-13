// app/api/procurement/purchase-orders/route.ts (CORRECT CODE)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import PurchaseOrder from '@/models/PurchaseOrder';
import User from '@/models/user';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) { return tenantId; }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { return NextResponse.json({ message: 'Unauthorized' }, { status: 401 }); }

    await connectToDatabase();
    const user = await User.findOne({ _id: session.user.id, tenantId }).populate('roleId');
    if (!user || !user.roleId) { return NextResponse.json({ message: 'User not found or misconfigured for this tenant.' }, { status: 403 }); }
    
    const userPermissions = user.roleId.permissions || [];
    const canViewAll = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_ALL);
    const canViewOwn = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_OWN);

    let query: any = { tenantId };
    if (canViewAll) {} 
    else if (canViewOwn) { query.createdBy = user._id; } 
    else { return NextResponse.json({ message: 'Forbidden: You do not have permission to view this data.' }, { status: 403 }); }
    
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate({ path: 'createdBy', select: 'name' })
      .populate({ path: 'products.product', select: 'name sku price' })
      .sort({ createdAt: -1 });

    return NextResponse.json(purchaseOrders);
  } catch (error) {
    console.error('CRITICAL ERROR fetching purchase orders:', error); 
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log("<<<<< EXECUTING THE CORRECT PURCHASE ORDER CREATE API - v3 >>>>>"); // For debugging
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) { return tenantId; }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { return NextResponse.json({ message: 'Unauthorized' }, { status: 401 }); }

    await connectToDatabase();
    const user = await User.findOne({ _id: session.user.id, tenantId }).populate('roleId');
    if (!user || !user.roleId) { return NextResponse.json({ message: 'User not found or misconfigured for this tenant.' }, { status: 403 }); }
    
    const userPermissions = user.roleId.permissions || [];
    if (!hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_CREATE)) { return NextResponse.json({ message: 'Forbidden: Your role cannot create Purchase Orders.' }, { status: 403 }); }

    const body = await req.json();
    const { products, expectedDeliveryDate, managerRemarks } = body;

    if (!products || products.length === 0 || !expectedDeliveryDate) { return NextResponse.json({ message: 'Missing required fields' }, { status: 400 }); }

    const lastPO = await PurchaseOrder.findOne({ tenantId }, {}, { sort: { 'createdAt' : -1 } });
    let sequence = 1;
    if (lastPO && lastPO.poId) {
      const lastSequence = parseInt(lastPO.poId.split('-')[2], 10);
      if (!isNaN(lastSequence)) { sequence = lastSequence + 1; }
    }
    const year = new Date().getFullYear();
    const sequenceString = sequence.toString().padStart(3, '0');
    const newPoId = `PO-${year}-${sequenceString}`;
    
    const newPO = new PurchaseOrder({
      tenantId, // THIS IS THE CRITICAL FIX
      poId: newPoId,
      products: products.map((p: any) => ({ product: p.productId, requestedQuantity: p.quantity, requestedPrice: p.price })),
      expectedDeliveryDate,
      managerRemarks,
      createdBy: session.user.id,
      status: 'Pending Admin Review',
      history: [{ status: 'Pending Admin Review', updatedBy: session.user.id, notes: "Order created.", timestamp: new Date() }],
    });

    await newPO.save();
    return NextResponse.json(newPO, { status: 201 });
  } catch (error) {
    console.error('CRITICAL ERROR creating purchase order:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}