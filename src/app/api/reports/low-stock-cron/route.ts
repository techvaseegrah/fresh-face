// FILE: src/app/api/reports/low-stock-cron/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Setting from '@/models/Setting';
import Product from '@/models/Product';
import { sendLowStockAlertEmail } from '@/lib/mail';

/**
 * This is a protected GET handler that acts as a Cron Job.
 * When triggered, it scans all products and sends a single report
 * if any are below the global low stock threshold.
 */
export async function GET(request: Request) {
  // +++ 1. SECURITY CHECK +++
  // We protect this route with a secret key stored in environment variables.
  // The cron job service must send this secret in the 'Authorization' header.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('[Cron Job] Starting scheduled low stock check...');
    await dbConnect();

    // +++ 2. CORE LOGIC +++
    // Fetch the global threshold setting
    const thresholdSetting = await Setting.findOne({ key: 'globalLowStockThreshold' }).lean();
    const globalThreshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 10;
    if (isNaN(globalThreshold)) {
      throw new Error('Global low stock threshold setting is not a valid number.');
    }

    // Find ALL products that are at or below the threshold
    // Using .lean() is efficient here because we only need to read the data.
    const lowStockProducts = await Product.find({
      numberOfItems: { $lte: globalThreshold } 
    }).lean();

    // +++ 3. ACTION +++
    if (lowStockProducts.length === 0) {
      console.log(`[Cron Job] All products are above the threshold of ${globalThreshold}. No alert needed.`);
      return NextResponse.json({ success: true, message: 'No low stock products found.' });
    }
    
    // If we found products, send the alert email
    console.log(`[Cron Job] Found ${lowStockProducts.length} low stock products. Sending alert...`);
    
    // We can call our existing email function! We don't 'await' it because
    // the cron job doesn't need to wait for the email to be sent.
    sendLowStockAlertEmail(lowStockProducts, globalThreshold);
    
    return NextResponse.json({ 
      success: true, 
      message: `Low stock alert triggered for ${lowStockProducts.length} products.` 
    });

  } catch (error: any) {
    console.error('[Cron Job] Error during scheduled low stock check:', error);
    return NextResponse.json({ success: false, message: 'Cron job failed.', error: error.message }, { status: 500 });
  }
}