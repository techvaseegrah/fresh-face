// app/api/inventory/alerts/route.ts (Updated)
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Product from '@/models/Product';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  // Get the tenant ID from the request or return an error response
  const tenantId = getTenantIdOrBail(req);
  if (tenantId instanceof NextResponse) {
    return tenantId; // Bails out if tenant ID is missing
  }

  try {
    await connectToDatabase();

    // The aggregation pipeline now starts by matching the products to the tenantId
    const lowStockProducts = await Product.aggregate([
      {
        // First, filter products by the current tenant
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId)
        }
      },
      {
        // Then, proceed with your existing logic
        $addFields: {
          stockPercentage: {
            $multiply: [
              { $divide: ["$quantity", "$quantityPerItem"] },
              100
            ]
          }
        }
      },
      {
        $match: {
          stockPercentage: { $lt: 25 } // Less than 25%
        }
      },
      {
        $sort: { stockPercentage: 1 } // Lowest stock first
      }
    ]);

    return NextResponse.json({
      success: true,
      alerts: lowStockProducts.map(product => ({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        currentQuantity: product.quantity,
        quantityPerItem: product.quantityPerItem,
        unit: product.unit,
        stockPercentage: Math.round(product.stockPercentage),
        alertLevel: product.stockPercentage < 10 ? 'critical' : 'low'
      }))
    });

  } catch (error: any) {
    console.error('Low stock alerts error:', error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred while fetching stock alerts." },
      { status: 500 }
    );
  }
}