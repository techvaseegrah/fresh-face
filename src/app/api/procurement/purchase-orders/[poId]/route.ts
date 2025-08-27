import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import PurchaseOrder, { PurchaseOrderStatus } from '@/models/PurchaseOrder';
import User from '@/models/user';
import Role from '@/models/role';
import mongoose from 'mongoose';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // ADDED: Import tenant helper

export async function GET(req: NextRequest, { params }: { params: { poId: string } }) {
  const { poId } = params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ADDED: Get tenantId or fail early
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    await connectToDatabase();
    
    // MODIFIED: User lookup is now scoped to the tenant
    const user = await User.findOne({ _id: session.user.id, tenantId }).populate('roleId');
    if (!user || !user.roleId) {
      return NextResponse.json({ message: 'User not found or misconfigured for this tenant.' }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(poId)) {
      return NextResponse.json({ message: 'Invalid Purchase Order ID' }, { status: 400 });
    }

    // MODIFIED: Purchase Order lookup is now scoped to the tenant. This is the most critical change.
    // We also populate everything in this one secure query.
    const purchaseOrder = await PurchaseOrder.findOne({ _id: poId, tenantId })
        .populate('createdBy', 'name').populate('reviewedBy', 'name').populate('approvedBy', 'name')
        .populate('history.updatedBy', 'name').populate('products.product', 'name sku price');
        
    if (!purchaseOrder) {
      // This now correctly handles "not found" AND "belongs to another tenant"
      return NextResponse.json({ message: 'Purchase Order not found' }, { status: 404 });
    }

    // --- This existing logic below is now safe because `purchaseOrder` was fetched securely ---
    const userPermissions = user.roleId.permissions || [];
    const canViewAll = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_ALL);
    const canViewOwn = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_OWN);
    
    const isCreator = purchaseOrder.createdBy.toString() === user._id.toString();
    if (!canViewAll && !(canViewOwn && isCreator)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(purchaseOrder);

  } catch (error) {
    console.error(`Failed to fetch PO ${poId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { poId: string } }) {
  const { poId } = params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ADDED: Get tenantId or fail early
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) {
        return tenantId;
    }

    await connectToDatabase();
    const body = await req.json();
    const { action, payload } = body; 
    
    // MODIFIED: User lookup is now scoped to the tenant
    const user = await User.findOne({ _id: session.user.id, tenantId }).populate('roleId');
    if (!user || !user.roleId) {
      return NextResponse.json({ message: 'User not found or misconfigured for this tenant.' }, { status: 403 });
    }
    const userPermissions = user.roleId.permissions || [];
    
    // MODIFIED: Purchase Order lookup is now scoped to the tenant
    const po = await PurchaseOrder.findOne({ _id: poId, tenantId });
    if (!po) {
      return NextResponse.json({ message: 'Purchase Order not found' }, { status: 404 });
    }

    // --- All existing logic below remains unchanged, but is now operating on a securely fetched document ---
    let newStatus: PurchaseOrderStatus | null = null;
    let notes = "";
    
    switch (action) {
      case 'SUBMIT_FOR_APPROVAL':
        if (hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_REVIEW) && po.status === PurchaseOrderStatus.PENDING_ADMIN_REVIEW) {
          po.products = payload.products;
          po.adminRemarks = payload.adminRemarks;
          po.reviewedBy = user._id;
          newStatus = PurchaseOrderStatus.PENDING_OWNER_APPROVAL;
          notes = `Reviewed by Admin. ${payload.adminRemarks || ''}`;
        } else {
          return NextResponse.json({ message: 'Action not allowed' }, { status: 403 });
        }
        break;

      case 'APPROVE':
      case 'CANCEL':
        if (hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_APPROVE) && po.status === PurchaseOrderStatus.PENDING_OWNER_APPROVAL) {
            if(action === 'APPROVE'){
                po.products = payload.products;
                po.ownerRemarks = payload.ownerRemarks;
                po.approvedBy = user._id;
                newStatus = PurchaseOrderStatus.APPROVED;
                notes = `Approved by Owner. ${payload.ownerRemarks || ''}`;
            } else { // CANCEL
                po.ownerRemarks = payload.remarks;
                newStatus = PurchaseOrderStatus.CANCELLED;
                notes = `Cancelled by Owner. Reason: ${payload.remarks || ''}`;
            }
        } else {
          return NextResponse.json({ message: 'Action not allowed' }, { status: 403 });
        }
        break;
        
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    if (newStatus) {
      po.status = newStatus;
      po.history.push({
        status: newStatus,
        updatedBy: user._id,
        timestamp: new Date(),
        notes: notes.trim(),
      });
    }

    await po.save();
    return NextResponse.json(po);

  } catch (error) {
    console.error(`Failed to update purchase order ${poId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}