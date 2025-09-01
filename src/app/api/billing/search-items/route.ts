// app/api/billing/search-items/route.ts - MODIFIED TO INCLUDE GIFT CARDS

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
import Setting from '@/models/Setting';
import { GiftCardTemplate } from '@/models/GiftCardTemplate'; // --- START ADDITION: Import GiftCardTemplate model ---
import { getTenantIdOrBail } from '@/lib/tenant';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

// ===================================================================================
//  GET: Handler to search for billable items for the current tenant
// ===================================================================================
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, items: [] });
    }

    const searchRegex = new RegExp(query, 'i');

    const searchCondition = {
      tenantId: tenantId,
      name: { $regex: searchRegex }
    };

    // --- START MODIFICATION: Add GiftCardTemplate to the parallel search ---
    const [services, products, giftCardTemplates] = await Promise.all([
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
      .lean(),

      // --- ADDITION: Search for active gift card templates ---
      GiftCardTemplate.find({
        ...searchCondition,
        isActive: true // Only show templates that are active and can be sold
      })
      .select('name amount')
      .limit(3) // Limit to a few results to not overwhelm
      .lean()
    ]);
    // --- END MODIFICATION ---

    // Format the results
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
      })),
      // --- START ADDITION: Format gift card templates into billable items ---
      ...giftCardTemplates.map(template => ({
        id: template._id.toString(),
        name: template.name,
        price: template.amount, // Note: The field is 'amount' in the model
        type: 'gift_card' as const // This type is crucial for the frontend
      }))
      // --- END ADDITION ---
    ];

    const lowerCaseQuery = query.toLowerCase();
    if ('membership fee'.includes(lowerCaseQuery)) {
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