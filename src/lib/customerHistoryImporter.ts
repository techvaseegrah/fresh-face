import mongoose from 'mongoose';
import * as xlsx from 'xlsx';
// --- CHANGE 1: REMOVE a direct dependency we no longer need ---
// import crypto from 'crypto'; 
import { promises as fs } from 'fs';
import connectToDatabase from './mongodb';
import ImportJob from '@/models/ImportJob';
import Customer from '@/models/customermodel';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
import Staff from '@/models/staff';
import Invoice from '@/models/invoice';
// --- CHANGE 2: IMPORT the correct helper function from your library ---
import { createBlindIndex } from '@/lib/search-indexing';

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
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    job.status = 'processing';
    job.progress = { total: rows.length, processed: 0, failed: 0 };
    await job.save();
    console.log(`[Importer] Job ${jobId}: Found ${rows.length} rows to process.`);

    const tenantId = job.tenantId;
    const [services, products, staff] = await Promise.all([
        ServiceItem.find({ tenantId }).select('name'),
        Product.find({ tenantId }).select('name sku'),
        Staff.find({ tenantId }).select('name staffIdNumber'),
    ]);

    const serviceMap = new Map(services.map(s => [s.name.toLowerCase(), s._id]));
    const productMapByName = new Map(products.map(p => [p.name.toLowerCase(), p._id]));
    const productMapBySku = new Map(products.map(p => [p.sku.toLowerCase(), p._id]));
    const staffMapByName = new Map(staff.map(s => [s.name.toLowerCase(), s._id]));
    const staffMapById = new Map(staff.map(s => [s.staffIdNumber.toLowerCase(), s._id]));

    for (const [index, row] of (rows as any[]).entries()) {
      const rowNum = index + 2;

      try {
        if (!row['Customer Phone'] || !row['Transaction Date'] || !row['Transaction Type'] || !row['Item Name'] || !row['Total Amount Paid'] || !row['Staff Name']) {
            throw new Error('Missing one or more required columns.');
        }

        // --- CHANGE 3: USE THE CORRECT HASHING METHOD ---
        const phone = String(row['Customer Phone']).replace(/\D/g, '');
        const phoneHash = createBlindIndex(phone); // Using your existing helper function
        const customer = await Customer.findOne({ phoneHash, tenantId });
        if (!customer) throw new Error(`Customer with phone ${phone} not found.`);

        // ... (the rest of the code is correct and remains the same)
        const staffIdNumber = row['Staff ID Number (Optional)']?.toString().toLowerCase().trim();
        const staffName = row['Staff Name']?.toString().toLowerCase().trim();
        const staffId = staffIdNumber ? staffMapById.get(staffIdNumber) : staffMapByName.get(staffName);
        if (!staffId) throw new Error(`Staff '${staffIdNumber || staffName}' not found.`);

        const transactionType = row['Transaction Type'].toLowerCase().trim();
        const itemName = row['Item Name'].toLowerCase().trim();
        const itemSku = row['Item SKU (Optional)']?.toLowerCase().trim();
        let itemId: mongoose.Types.ObjectId | undefined;
        let itemTypeForInvoice: 'service' | 'product';
        let originalItemName: string = row['Item Name'];

        if (transactionType === 'service') {
          itemId = serviceMap.get(itemName);
          itemTypeForInvoice = 'service';
        } else if (transactionType === 'product') {
          itemId = itemSku ? productMapBySku.get(itemSku) : productMapByName.get(itemName);
          itemTypeForInvoice = 'product';
        } else {
          throw new Error(`Unsupported transaction type: '${transactionType}'. Use 'Service' or 'Product'.`);
        }
        if (!itemId) throw new Error(`${transactionType} '${itemName || itemSku}' not found in the database.`);

        const totalAmount = parseFloat(row['Total Amount Paid']);
        if (isNaN(totalAmount)) throw new Error('Invalid value for "Total Amount Paid".');
        
        let transactionDate;
        if (typeof row['Transaction Date'] === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            transactionDate = new Date(excelEpoch.getTime() + row['Transaction Date'] * 24 * 60 * 60 * 1000);
        } else {
            transactionDate = new Date(row['Transaction Date']);
        }
        if (isNaN(transactionDate.getTime())) throw new Error('Invalid format for "Transaction Date". Use YYYY-MM-DD or a valid date format.');

        const newInvoice = new Invoice({
            tenantId,
            customerId: customer._id,
            appointmentId: null,
            stylistId: staffId,
            billingStaffId: staffId,
            lineItems: [{
                tenantId,
                itemType: itemTypeForInvoice,
                itemId: itemId.toString(),
                name: originalItemName,
                quantity: 1,
                unitPrice: totalAmount,
                finalPrice: totalAmount,
                staffId: staffId,
            }],
            serviceTotal: itemTypeForInvoice === 'service' ? totalAmount : 0,
            productTotal: itemTypeForInvoice === 'product' ? totalAmount : 0,
            subtotal: totalAmount,
            grandTotal: totalAmount,
            paymentDetails: { cash: 0, card: 0, upi: 0, other: totalAmount },
            paymentStatus: 'Paid',
            isImported: true,
            createdAt: transactionDate,
            updatedAt: transactionDate,
        });
        await newInvoice.save();
        
        job.progress.processed++;
      } catch (error: any) {
        job.progress.failed++;
        job.errorLog.push({
          row: rowNum,
          message: error.message,
          data: JSON.stringify(row),
        });
      }
       if (index % 10 === 0 || index === rows.length - 1) {
        await job.save();
      }
    }

    job.status = 'completed';
    job.reportMessage = `Import finished. ${job.progress.processed} successful, ${job.progress.failed} failed.`;
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