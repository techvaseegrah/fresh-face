import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import PurchaseOrder from '@/models/PurchaseOrder';
import User from '@/models/user';
import Role from '@/models/role';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await User.findById(session.user.id).populate('roleId');
    if (!user || !user.roleId) {
      return NextResponse.json({ message: 'User configuration error' }, { status: 403 });
    }
    
    // --- NEW: Using your permission system ---
    const userPermissions = user.roleId.permissions || [];

    // Check if user has permission to view all or only their own
    const canViewAll = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_ALL);
    const canViewOwn = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_OWN);

    let query: any = {};

    if (canViewAll) {
      // No filter needed, user can see all POs.
      query = {};
    } else if (canViewOwn) {
      // User can only see POs they created.
      query = { createdBy: user._id };
    } else {
      // If user has neither permission, they are forbidden.
      return NextResponse.json({ message: 'Forbidden: You do not have permission to view this data.' }, { status: 403 });
    }
    
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await User.findById(session.user.id).populate('roleId');
    if (!user || !user.roleId) {
      return NextResponse.json({ message: 'User configuration error' }, { status: 403 });
    }
    
    // --- NEW: Using your permission system ---
    const userPermissions = user.roleId.permissions || [];
    if (!hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_CREATE)) {
      return NextResponse.json({ message: 'Forbidden: Your role cannot create Purchase Orders.' }, { status: 403 });
    }

    const body = await req.json();
    const { products, expectedDeliveryDate, managerRemarks } = body;

    // ... (rest of the POST function is the same as before)
    if (!products || products.length === 0 || !expectedDeliveryDate) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    const lastPO = await PurchaseOrder.findOne({}, {}, { sort: { 'createdAt' : -1 } });
    let sequence = 1;
    if (lastPO && lastPO.poId) {
      const lastSequence = parseInt(lastPO.poId.split('-')[2], 10);
      if (!isNaN(lastSequence)) { sequence = lastSequence + 1; }
    }
    const year = new Date().getFullYear();
    const sequenceString = sequence.toString().padStart(3, '0');
    const newPoId = `PO-${year}-${sequenceString}`;
    
    const newPO = new PurchaseOrder({
      poId: newPoId,
      products: products.map((p: any) => ({
        product: p.productId,
        requestedQuantity: p.quantity,
        requestedPrice: p.price,
      })),
      expectedDeliveryDate,
      managerRemarks,
      createdBy: session.user.id,
      status: 'Pending Admin Review',
      history: [{
        status: 'Pending Admin Review',
        updatedBy: session.user.id,
        notes: "Order created.",
        timestamp: new Date(),
      }],
    });
    await newPO.save();
    return NextResponse.json(newPO, { status: 201 });
  } catch (error) {
    console.error('CRITICAL ERROR creating purchase order:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}