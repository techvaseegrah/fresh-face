// app/api/billing/search-items/route.ts - MULTI-TENANT REFACTORED VERSION

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
import Setting from '@/models/Setting';
import { getTenantIdOrBail } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

// ===================================================================================
//  GET: Handler to search for billable items for the current tenant
// ===================================================================================
export async function GET(req: NextRequest) {
  try {
    // --- MT: Get tenantId and check permissions first ---
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    // const session = await getServerSession(authOptions);
    // if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.BILLING_CREATE)) { // Assuming a permission
    //   return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    // }

    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, items: [] });
    }

    const searchRegex = new RegExp(query, 'i');

    // --- MT: Create a scoped search condition ---
    const searchCondition = {
      tenantId: tenantId,
      name: { $regex: searchRegex }
    };

    // Search both services and products in parallel, now scoped by tenant
    const [services, products] = await Promise.all([
      ServiceItem.find(searchCondition)
        .select('name price membershipRate')
        .limit(5)
        .lean(),
      
      Product.find({
        ...searchCondition,
        type: 'Retail'
      })
      .populate('brand', 'name')
      .populate('subCategory', 'name')
      .select('name price sku unit brand numberOfItems') 
      .limit(5)
      .lean()
    ]);

    // Format the results (your existing logic is good)
    let items = [
      ...services.map(service => ({
        id: service._id.toString(),
        name: service.name,
        price: service.price,
        membershipRate: service.membershipRate,
        type: 'service' as const
      })),
      ...products.map(product => ({
        id: product._id.toString(),
        name: product.name,
        price: product.price,
        type: 'product' as const,
        sku: product.sku,
        unit: product.unit,
        categoryName: (product.brand as any)?.name || 'Product', 
        stock: (product as any).numberOfItems
      }))
    ];

    // --- MT: Inject the TENANT-SPECIFIC membership fee ---
    const lowerCaseQuery = query.toLowerCase();
    if ('membership fee'.includes(lowerCaseQuery)) {
      // --- MT: Scope the Setting lookup by tenantId ---
      const feeSetting = await Setting.findOne({ key: 'membershipFee', tenantId }).lean();
      
      if (feeSetting && feeSetting.value) {
        const feePrice = parseFloat(feeSetting.value);
        if (!isNaN(feePrice) && feePrice > 0) {
          const membershipFeeItem = {
            id: MEMBERSHIP_FEE_ITEM_ID,
            name: 'New Membership Fee',
            price: feePrice,
            type: 'fee' as const,
          };
          items.unshift(membershipFeeItem);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      items 
    });

  } catch (error: any) {
    console.error('API Error searching billing items:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to search items' 
    }, { status: 500 });
  }
}