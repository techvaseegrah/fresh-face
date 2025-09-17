import mongoose from 'mongoose';
import * as xlsx from 'xlsx';
import { promises as fs } from 'fs';
import connectToDatabase from './mongodb';
import ImportJob from '@/models/ImportJob';
import Customer from '@/models/customermodel';
import Invoice from '@/models/invoice';
import { createBlindIndex } from '@/lib/search-indexing';

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

    // --- STEP 1: Group by Original Invoice Number ONLY ---
    const invoiceGroups = new Map<string, any[]>();
    rows.forEach((row, index) => {
        const invoiceId = row['Original Invoice Number'] || `_autogen_${jobId}_${index}`;
        if (!invoiceGroups.has(invoiceId)) { invoiceGroups.set(invoiceId, []); }
        invoiceGroups.get(invoiceId)!.push(row);
    });

    job.status = 'processing';
    job.progress = { total: invoiceGroups.size, processed: 0, failed: 0 };
    await job.save();
    console.log(`[Importer] Job ${jobId}: Found ${rows.length} rows, grouped into ${invoiceGroups.size} potential invoices.`);

    const tenantId = job.tenantId;
    
    for (const [invoiceId, groupRows] of invoiceGroups.entries()) {
      try {
        // --- STEP 2: VALIDATE DATA CONSISTENCY WITHIN THE GROUP ---
        if (!invoiceId.startsWith('_autogen_') && groupRows.length > 1) {
          const firstPhone = String(groupRows[0]['Customer Phone']).replace(/\D/g, '');
          for (let i = 1; i < groupRows.length; i++) {
            const currentRowPhone = String(groupRows[i]['Customer Phone']).replace(/\D/g, '');
            if (currentRowPhone !== firstPhone) {
              throw new Error(`Data conflict in Excel file. Rows for this invoice have different customer phone numbers. Please ensure all line items for one invoice belong to one customer.`);
            }
          }
        }

        const firstRow = groupRows[0];
        
        const phone = String(firstRow['Customer Phone']).replace(/\D/g, '');
        if (!phone) throw new Error('Missing "Customer Phone" for an invoice.');
        const phoneHash = createBlindIndex(phone);
        const customer = await Customer.findOne({ phoneHash, tenantId });
        if (!customer) {
            throw new Error(`Customer with phone ${phone} not found in the database. This is a required field.`);
        }

        // --- STEP 3: PREPARE NEW LINE ITEMS AND CALCULATE TOTALS ---
        const newLineItems = [];
        let newServiceTotal = 0;
        let newProductTotal = 0;

        for (const itemRow of groupRows) {
          if (!itemRow['Transaction Type'] || !itemRow['Item Name'] || !itemRow['Quantity'] || !itemRow['Unit Price'] || !itemRow['Staff Name']) {
            throw new Error('Missing one or more required columns for an item: Transaction Type, Item Name, Quantity, Unit Price, Staff Name.');
          }
          
          const transactionType = cleanName(itemRow['Transaction Type']);
          if (transactionType !== 'service' && transactionType !== 'product') { throw new Error(`Unsupported transaction type: '${itemRow['Transaction Type']}'.`); }
          
          const quantity = parseInt(itemRow['Quantity']) || 1;
          const unitPrice = parseFloat(itemRow['Unit Price']);
          if(isNaN(quantity) || isNaN(unitPrice)) { throw new Error('Invalid Quantity or Unit Price.'); }
          
          const finalPrice = quantity * unitPrice;
          if (transactionType === 'service') newServiceTotal += finalPrice;
          if (transactionType === 'product') newProductTotal += finalPrice;

          newLineItems.push({
            tenantId, itemType: transactionType, name: itemRow['Item Name'], staffName: itemRow['Staff Name'],
            quantity, unitPrice, finalPrice,
          });
        }
        
        // --- STEP 4: FIND OR CREATE/UPDATE INVOICE ---
        const existingInvoice = await Invoice.findOne({ tenantId, invoiceNumber: invoiceId, customerId: customer._id });

        if (existingInvoice) {
            console.log(`[Importer] Found existing invoice ${invoiceId}. Appending new items...`);
            existingInvoice.lineItems.push(...newLineItems);
            existingInvoice.serviceTotal += newServiceTotal;
            existingInvoice.productTotal += newProductTotal;
            existingInvoice.subtotal = existingInvoice.serviceTotal + existingInvoice.productTotal;
            existingInvoice.grandTotal = existingInvoice.subtotal; // Assumes no discounts
            const newPaymentAmount = newServiceTotal + newProductTotal;
            const paymentMode = (firstRow['Payment Mode'] || 'other').toString().toLowerCase();
            switch (paymentMode) {
                case 'cash': existingInvoice.paymentDetails.cash += newPaymentAmount; break;
                case 'card': existingInvoice.paymentDetails.card += newPaymentAmount; break;
                case 'gpay': case 'upi': case 'phonepe': existingInvoice.paymentDetails.upi += newPaymentAmount; break;
                default: existingInvoice.paymentDetails.other += newPaymentAmount; break;
            }
            await existingInvoice.save();
        } else {
            console.log(`[Importer] No existing invoice found for ${invoiceId}. Creating new...`);
            const grandTotal = newServiceTotal + newProductTotal;
            const paymentMode = (firstRow['Payment Mode'] || 'other').toString().toLowerCase();
            const paymentDetails = { cash: 0, card: 0, upi: 0, other: 0 };
            switch (paymentMode) {
                case 'cash': paymentDetails.cash = grandTotal; break;
                case 'card': paymentDetails.card = grandTotal; break;
                case 'gpay': case 'upi': case 'phonepe': paymentDetails.upi = grandTotal; break;
                default: paymentDetails.other = grandTotal; break;
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
                    transactionDate = new Date(year, month - 1, day);
                }
            }
            if (!transactionDate || isNaN(transactionDate.getTime())) {
                throw new Error(`Invalid Transaction Date format for value: '${dateValue}'. Please use DD-MM-YYYY HH:mm.`);
            }
            transactionDate.setHours(0, 0, 0, 0);

            const newInvoice = new Invoice({
                tenantId,
                invoiceNumber: invoiceId.startsWith('_autogen_') ? undefined : invoiceId,
                customerId: customer._id,
                stylistId: null,
                billingStaffId: null,
                lineItems: newLineItems,
                grandTotal,
                serviceTotal: newServiceTotal,
                productTotal: newProductTotal,
                subtotal: newServiceTotal + newProductTotal,
                paymentDetails,
                paymentStatus: 'Paid', 
                isImported: true, 
                createdAt: transactionDate, 
                updatedAt: transactionDate,
            });
            await newInvoice.save();
        }
        
        job.progress.processed++;
      } catch (error: any) {
        job.progress.failed++;
        job.errorLog.push({ row: 0, message: `Invoice '${invoiceId}': ${error.message}`, data: JSON.stringify(groupRows) });
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