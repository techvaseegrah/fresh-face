import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import PurchaseOrder, { PurchaseOrderStatus } from '@/models/PurchaseOrder';
import ProductModel from '@/models/Product';
import User from '@/models/user';
import Role from '@/models/role';
import mongoose from 'mongoose';
import { writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
// --- NEW: Import permissions ---
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

async function uploadToCloudStorage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'invoices');
  try {
    await stat(uploadDir);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await mkdir(uploadDir, { recursive: true });
    } else {
      console.error('Error checking directory:', error);
      throw error;
    }
  }
  const filePath = join(uploadDir, filename);
  await writeFile(filePath, buffer);
  return `/uploads/invoices/${filename}`;
}

export async function POST(req: NextRequest, { params }: { params: { poId: string } }) {
  const { poId } = params;
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
    if (!hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_RECEIVE)) {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to receive stock.' }, { status: 403 });
    }
    
    if (!mongoose.Types.ObjectId.isValid(poId)) {
      return NextResponse.json({ message: 'Invalid Purchase Order ID' }, { status: 400 });
    }

    const po = await PurchaseOrder.findById(poId);
    if (!po) { return NextResponse.json({ message: 'Purchase Order not found' }, { status: 404 }); }
    if (![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(po.status)) {
      return NextResponse.json({ message: `Cannot receive stock for an order with status "${po.status}"` }, { status: 400 });
    }
    
    // ... (rest of the POST function is the same as before)
    const formData = await req.formData();
    const receivedProductsData = formData.get('products');
    const invoiceFile = formData.get('invoice') as File | null;

    if (!invoiceFile) { return NextResponse.json({ message: 'Invoice file is mandatory' }, { status: 400 }); }
    if (!receivedProductsData || typeof receivedProductsData !== 'string') {
      return NextResponse.json({ message: 'Received products data is missing' }, { status: 400 });
    }

    const receivedProducts = JSON.parse(receivedProductsData);
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const invoiceUrl = await uploadToCloudStorage(invoiceFile);
      po.invoiceUrl = invoiceUrl;

      for (const receivedItem of receivedProducts) {
        await ProductModel.findByIdAndUpdate(receivedItem.productId, { $inc: { numberOfItems: receivedItem.quantity } }, { session: dbSession });
        const productInPO = po.products.find(p => p.product.toString() === receivedItem.productId);
        if (productInPO) { productInPO.receivedQuantity += receivedItem.quantity; }
      }

      let allItemsFullyReceived = true;
      for (const productInPO of po.products) {
        if (productInPO.receivedQuantity < productInPO.approvedQuantity) { allItemsFullyReceived = false; break; }
      }
      
      const newStatus = allItemsFullyReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      po.status = newStatus;

      po.history.push({
        status: newStatus, updatedBy: user._id, timestamp: new Date(), notes: `Stock received. Invoice: ${invoiceUrl}`,
      });
      
      await po.save({ session: dbSession });
      await dbSession.commitTransaction();
      return NextResponse.json(po);
    } catch (error) {
      await dbSession.abortTransaction();
      console.error(`Failed to receive stock for PO ${poId}:`, error);
      return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    } finally {
      dbSession.endSession();
    }
  } catch (error) {
    console.error('Outer error in receive stock:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}