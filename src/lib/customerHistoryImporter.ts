import mongoose from 'mongoose';
import * as xlsx from 'xlsx';
import { promises as fs } from 'fs';
import connectToDatabase from './mongodb';
import ImportJob from '@/models/ImportJob';
import Customer from '@/models/customermodel';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
import Staff from '@/models/staff';
import Invoice from '@/models/invoice';
import { createBlindIndex } from '@/lib/search-indexing';
import { findBestMatch } from 'string-similarity';

// Helper function to normalize names for reliable matching
const cleanName = (name: any): string => {
    if (!name) return '';
    return name.toString().toLowerCase().replace(/\s+/g, ' ').trim();
};

export async function processHistoryImport(filePath: string, jobId: string) {
  await connectToDatabase();
  console.log(`[Importer] Starting job ${jobId} for file: ${filePath}`);

  const job = await ImportJob.findById(jobId);
  if (!job) {
    console.error(`[Importer] Job ${jobId} not found. Aborting.`);
    return;
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

    const invoiceGroups = new Map<string, any[]>();
    rows.forEach((row, index) => {
        const invoiceId = row['Original Invoice Number'] || `_autogen_${jobId}_${index}`;
        if (!invoiceGroups.has(invoiceId)) { invoiceGroups.set(invoiceId, []); }
        invoiceGroups.get(invoiceId)!.push(row);
    });

    job.status = 'processing';
    job.progress = { total: invoiceGroups.size, processed: 0, failed: 0 };
    await job.save();
    console.log(`[Importer] Job ${jobId}: Found ${rows.length} rows, grouped into ${invoiceGroups.size} invoices.`);

    const tenantId = job.tenantId;
    const [services, products, staff] = await Promise.all([
        ServiceItem.find({ tenantId }).select('name'),
        Product.find({ tenantId }).select('name sku'),
        Staff.find({ tenantId }).select('name staffIdNumber'),
    ]);

    const serviceMap = new Map(services.map(s => [cleanName(s.name), s._id]));
    const productMapByName = new Map(products.map(p => [cleanName(p.name), p._id]));
    const productMapBySku = new Map(products.map(p => [cleanName(p.sku), p._id]));
    const staffMapByName = new Map(staff.map(s => [cleanName(s.name), s._id]));
    const staffMapById = new Map(staff.map(s => [s.staffIdNumber.toLowerCase(), s._id]));
    
    // --- DEBUGGING STEP 1 ---
    // Log all the cleaned product names that are in our lookup map.
    // This shows us exactly what the keys look like to the computer.
    console.log("--- DEBUG: Product names from Database (after cleaning) ---");
    console.log(Array.from(productMapByName.keys()));
    console.log("----------------------------------------------------------");
    
    const allServiceNames = services.map(s => s.name);
    const allProductNames = products.map(p => p.name);

    for (const [invoiceId, groupRows] of invoiceGroups.entries()) {
      try {
        const firstRow = groupRows[0];
        const phone = String(firstRow['Customer Phone']).replace(/\D/g, '');
        const phoneHash = createBlindIndex(phone);
        const customer = await Customer.findOne({ phoneHash, tenantId });
        if (!customer) throw new Error(`Customer with phone ${phone} not found.`);

        const grandTotal = parseFloat(firstRow['Total Amount']);
        if (isNaN(grandTotal)) throw new Error('Missing or invalid "Total Amount"');
        
        const paymentMode = (firstRow['Payment Mode'] || 'other').toString().toLowerCase();
        const paymentDetails = { cash: 0, card: 0, upi: 0, other: 0 };
        switch (paymentMode) {
            case 'cash': paymentDetails.cash = grandTotal; break;
            case 'card': paymentDetails.card = grandTotal; break;
            case 'gpay': case 'upi': case 'phonepe': paymentDetails.upi = grandTotal; break;
            default: paymentDetails.other = grandTotal; break;
        }

        const lineItems = [];
        let serviceTotal = 0, productTotal = 0;
        let primaryStylistId: mongoose.Types.ObjectId | null = null;

        for (const itemRow of groupRows) {
          if (!itemRow['Transaction Type'] || !itemRow['Item Name'] || !itemRow['Quantity'] || !itemRow['Unit Price'] || !itemRow['Staff Name']) {
            throw new Error('Missing one or more required columns for an item.');
          }
          
          const staffName = cleanName(itemRow['Staff Name']);
          const staffId = staffMapByName.get(staffName);
          if (!staffId) throw new Error(`Staff '${itemRow['Staff Name']}' not found.`);
          if (!primaryStylistId) primaryStylistId = staffId;

          const transactionType = cleanName(itemRow['Transaction Type']);
          const itemNameFromSheet = itemRow['Item Name'];
          const cleanedItemName = cleanName(itemNameFromSheet);
          const itemSku = cleanName(itemRow['Item SKU (Optional)']);
          let itemId, itemTypeForInvoice;

          if (transactionType === 'service') {
            itemTypeForInvoice = 'service';
            itemId = serviceMap.get(cleanedItemName);
            if (!itemId) {
                const bestMatch = findBestMatch(itemNameFromSheet, allServiceNames);
                if (bestMatch.bestMatch.rating > 0.7) { throw new Error(`service '${itemNameFromSheet}' not found. Did you mean '${bestMatch.bestMatch.target}'?`); }
                throw new Error(`service '${itemNameFromSheet}' not found.`);
            }
          } else if (transactionType === 'product') {
            itemTypeForInvoice = 'product';

            // --- DEBUGGING STEP 2 ---
            // Log exactly what we are about to look up to find the invisible difference.
            console.log(`--- DEBUG: Attempting to find product ---`);
            console.log(`Original name from Excel: "${itemNameFromSheet}"`);
            console.log(`Cleaned name for lookup:   "${cleanedItemName}"`);
            
            itemId = itemSku ? productMapBySku.get(itemSku) : productMapByName.get(cleanedItemName);

            console.log(`Result of lookup: ${itemId ? 'FOUND' : 'NOT FOUND'}`);
            console.log(`-----------------------------------------`);
            
            if (!itemId) {
                const bestMatch = findBestMatch(itemNameFromSheet, allProductNames);
                if (bestMatch.bestMatch.rating > 0.7) { throw new Error(`product '${itemNameFromSheet}' not found. Did you mean '${bestMatch.bestMatch.target}'?`); }
                throw new Error(`product '${itemNameFromSheet}' not found.`);
            }
          } else {
            throw new Error(`Unsupported transaction type: '${transactionType}'.`);
          }
          
          const quantity = parseInt(itemRow['Quantity']) || 1;
          const unitPrice = parseFloat(itemRow['Unit Price']);
          if(isNaN(quantity) || isNaN(unitPrice)) throw new Error('Invalid Quantity or Unit Price.');
          
          const finalPrice = quantity * unitPrice;
          if (itemTypeForInvoice === 'service') serviceTotal += finalPrice;
          if (itemTypeForInvoice === 'product') productTotal += finalPrice;

          lineItems.push({
            tenantId, itemType: itemTypeForInvoice, itemId: itemId.toString(), name: itemNameFromSheet,
            quantity, unitPrice, finalPrice, staffId,
          });
        }
        
        let transactionDate;
        const dateValue = firstRow['Transaction Date'];
        if (typeof dateValue === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            transactionDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        } else if (typeof dateValue === 'string') {
            const parts = dateValue.split(/[\s-:]+/);
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                const hours = parts.length > 3 ? parseInt(parts[3], 10) : 0;
                const minutes = parts.length > 4 ? parseInt(parts[4], 10) : 0;
                transactionDate = new Date(year, month - 1, day, hours, minutes);
            }
        }
        if (!transactionDate || isNaN(transactionDate.getTime())) {
            throw new Error(`Invalid Transaction Date format for value: '${dateValue}'. Please use DD-MM-YYYY HH:mm.`);
        }

        const newInvoice = new Invoice({
            tenantId,
            invoiceNumber: invoiceId.startsWith('_autogen_') ? undefined : invoiceId,
            customerId: customer._id,
            stylistId: primaryStylistId, billingStaffId: primaryStylistId, lineItems, grandTotal,
            serviceTotal, productTotal, subtotal: serviceTotal + productTotal, paymentDetails,
            paymentStatus: 'Paid', isImported: true, createdAt: transactionDate, updatedAt: transactionDate,
        });
        await newInvoice.save();

        job.progress.processed++;
      } catch (error: any) {
        job.progress.failed++;
        job.errorLog.push({ row: 0, message: `Invoice '${invoiceId.startsWith('_autogen_') ? 'Auto-Generated' : invoiceId}': ${error.message}`, data: JSON.stringify(groupRows) });
      }
      await job.save();
    }

    job.status = 'completed';
    job.reportMessage = `Import finished. ${job.progress.processed} invoices successful, ${job.progress.failed} failed.`;
    console.log(`[Importer] Job ${jobId} completed.`);
  } catch (error: any) {
    job.status = 'failed';
    job.reportMessage = `A fatal error occurred: ${error.message}`;
    console.error(`[Importer] Job ${jobId} failed with fatal error:`, error);
  } finally {
    await job.save();
    await fs.unlink(filePath).catch(err => console.error(`[Importer] Failed to delete temp file ${filePath}:`, err));
  }
}