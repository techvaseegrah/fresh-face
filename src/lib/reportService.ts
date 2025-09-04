// src/lib/reportService.ts

import  dbConnect  from '@/lib/dbConnect';
import { safeDecrypt } from '@/lib/crypto'; 
import { GiftCard } from '@/models/GiftCard';
import { GiftCardLog } from '@/models/GiftCardLog';
import '@/models/customermodel';
import '@/models/staff';
import '@/models/GiftCardTemplate';
import '@/models/invoice';

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