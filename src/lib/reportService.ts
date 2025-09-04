// src/lib/reportService.ts

import  dbConnect  from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto'; 
import { GiftCard } from '@/models/GiftCard';
import { GiftCardLog } from '@/models/GiftCardLog';
import '@/models/customermodel';
import '@/models/staff';
import '@/models/GiftCardTemplate';
import '@/models/invoice';

// ▼▼▼ ADD IMPORTS FOR THE NEW PACKAGE REPORTS ▼▼▼
import CustomerPackage from '@/models/CustomerPackage';
import CustomerPackageLog from '@/models/CustomerPackageLog';
import ServiceItem from '@/models/ServiceItem';
import Product from '@/models/Product';
// Note: 'staff' and 'customermodel' are already imported above.
// ▲▲▲ END OF ADDITION ▲▲▲


/**
 * Fetches and prepares data for the Gift Card Sold report.
 */
export async function fetchSoldReportData(tenantId: string, fromDate: Date, toDate: Date) {
    await dbConnect();

    const soldCards = await GiftCard.find({ 
        tenantId, 
        issueDate: { $gte: fromDate, $lte: toDate }
    })
    .populate('customerId', 'name phoneNumber') 
    .populate('issuedByStaffId', 'name')
    .populate('giftCardTemplateId', 'name')
    .populate('purchaseInvoiceId', 'invoiceNumber')
    .sort({ issueDate: -1 })
    .lean();

    // Decrypt and format data for a clean report
    return soldCards.map(card => ({
        invoiceNumber: (card.purchaseInvoiceId as any)?.invoiceNumber || 'N/A',
        purchaseDate: new Date(card.issueDate).toLocaleDateString('en-GB'),
        expiryDate: new Date(card.expiryDate).toLocaleDateString('en-GB'),
        giftCardName: (card.giftCardTemplateId as any)?.name || 'N/A',
        giftCardNumber: card.uniqueCode,
        guestName: safeDecrypt((card.customerId as any)?.name, 'customer name'),
        guestNumber: safeDecrypt((card.customerId as any)?.phoneNumber, 'customer phone'),
        staff: (card.issuedByStaffId as any)?.name || 'N/A',
        amount: card.initialBalance,
    }));
}

/**
 * Fetches and prepares data for the Gift Card Redemption report.
 */
export async function fetchRedemptionReportData(tenantId: string, fromDate: Date, toDate: Date) {
    await dbConnect();
    
    const redemptionLogs = await GiftCardLog.find({
        tenantId,
        createdAt: { $gte: fromDate, $lte: toDate }
    })
    .populate('customerId', 'name phoneNumber')
    .populate({
        path: 'giftCardId',
        select: 'uniqueCode giftCardTemplateId',
        populate: { path: 'giftCardTemplateId', select: 'name' }
    })
    .sort({ createdAt: -1 })
    .lean();

    // Decrypt and format data
    return redemptionLogs.map(log => ({
        date: new Date(log.createdAt).toLocaleDateString('en-GB'),
        giftCardName: (log.giftCardId as any)?.giftCardTemplateId?.name || 'N/A',
        giftCardNumber: (log.giftCardId as any)?.uniqueCode || 'N/A',
        guestName: safeDecrypt((log.customerId as any)?.name, 'customer name'),
        guestNumber: safeDecrypt((log.customerId as any)?.phoneNumber, 'customer phone'),
        amountRedeemed: log.amountRedeemed,
        remark: '' // Placeholder for remarks
    }));
}

// ▼▼▼ ADD THESE TWO NEW FUNCTIONS ▼▼▼

/**
 * Fetches and prepares data for the Package Sales report.
 */
export async function fetchPackageSalesReportData(tenantId: string, fromDate: Date, toDate: Date) {
    await dbConnect();
    const sales = await CustomerPackage.find({ tenantId, purchaseDate: { $gte: fromDate, $lte: toDate } })
        .populate('customerId', 'name phoneNumber')
        .populate('packageTemplateId', 'name')
        .populate('soldBy', 'name')
        .sort({ purchaseDate: -1 }).lean();

    return sales.map(s => ({
        dateSold: new Date(s.purchaseDate).toLocaleString('en-GB'),
        packageName: (s.packageTemplateId as any)?.name || 'N/A',
        customerName: safeDecrypt((s.customerId as any)?.name, 'cust name'),
        customerPhone: safeDecrypt((s.customerId as any)?.phoneNumber, 'cust phone'),
        price: s.purchasePrice,
        soldBy: (s.soldBy as any)?.name || 'N/A',
        status: s.status,
    }));
}

/**
 * Fetches and prepares data for the Package Redemptions report.
 */
export async function fetchPackageRedemptionsReportData(tenantId: string, fromDate: Date, toDate: Date) {
    await dbConnect();
    const logs = await CustomerPackageLog.find({ tenantId, redemptionDate: { $gte: fromDate, $lte: toDate } })
        .populate({
            path: 'customerPackageId',
            populate: [
                { path: 'customerId', select: 'name' },
                { path: 'packageTemplateId', select: 'name' }
            ]
        })
        .populate('redeemedBy', 'name')
        .sort({ redemptionDate: -1 }).lean();

    return await Promise.all(logs.map(async log => {
        let itemName = 'N/A';
        if (log.redeemedItemType === 'service') {
            const service = await ServiceItem.findById(log.redeemedItemId, 'name').lean();
            itemName = service?.name || 'N/A';
        } else if (log.redeemedItemType === 'product') {
            const product = await Product.findById(log.redeemedItemId, 'name').lean();
            itemName = product?.name || 'N/A';
        }
        return {
            dateRedeemed: new Date(log.redemptionDate).toLocaleString('en-GB'),
            packageName: (log.customerPackageId as any)?.packageTemplateId?.name || 'N/A',
            customerName: safeDecrypt((log.customerPackageId as any)?.customerId?.name, 'cust name'),
            itemRedeemed: itemName,
            quantity: log.quantityRedeemed,
            redeemedBy: (log.redeemedBy as any)?.name || 'N/A',
        };
    }));
}
// ▲▲▲ END OF ADDITION ▲▲▲