// FILE: /app/api/billing/route.ts - COMPLETE FINAL FIXED VERSION

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import Appointment from '@/models/Appointment';
import Invoice from '@/models/invoice';
import Stylist from '@/models/Stylist';
import Customer from '@/models/customermodel';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import Setting from '@/models/Setting';
import Product, { IProduct } from '@/models/Product';
import User from '@/models/user'; // ADD THIS - For billing staff lookup
import { InventoryManager, InventoryUpdate } from '@/lib/inventoryManager';
import { whatsAppService } from '@/lib/whatsapp';
import { decrypt } from '@/lib/crypto';

const MEMBERSHIP_FEE_ITEM_ID = 'MEMBERSHIP_FEE_PRODUCT_ID';

export async function POST(req: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  let pointsEarned = 0;

  try {
    await connectToDatabase();

    const body = await req.json();
    console.log("--- RECEIVED BILLING BODY ---");
    console.log("billingStaffId:", body.billingStaffId);
    console.log("billingStaffId type:", typeof body.billingStaffId);

    const {
      appointmentId, customerId, stylistId, billingStaffId, items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      manualDiscountType, manualDiscountValue, finalManualDiscountApplied,
    } = body;

    // --- 1. PRE-VALIDATION ---
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        throw new Error('Invalid or missing Appointment ID.');
    }
    const totalPaid = Object.values(paymentDetails).reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0);
    if (Math.abs(totalPaid - grandTotal) > 0.01) {
      throw new Error(`Payment amount mismatch. Total: ₹${grandTotal}, Paid: ₹${totalPaid}`);
    }

    // --- 2. CRITICAL STOCK VALIDATION ---
    const productItemsToBill = items.filter((item: any) => item.itemType === 'product' && item.itemId !== MEMBERSHIP_FEE_ITEM_ID);
    
    if (productItemsToBill.length > 0) {
      const productIds = productItemsToBill.map((item: any) => item.itemId);
      const productsInDb = await Product.find({ _id: { $in: productIds } }).session(session);
      const productMap = new Map(productsInDb.map(p => [p._id.toString(), p]));

      for (const item of productItemsToBill) {
        const dbProduct = productMap.get(item.itemId);
        if (!dbProduct) throw new Error(`Product "${item.name}" not found in database.`);
        if (dbProduct.numberOfItems < item.quantity) {
          throw new Error(`Insufficient stock for "${dbProduct.name}". Requested: ${item.quantity}, Available: ${dbProduct.numberOfItems}.`);
        }
      }
      console.log("Stock validation passed for all products.");
    }

    // --- 3. DATA FETCHING ---
    const appointment = await Appointment.findById(appointmentId).populate('serviceIds').session(session);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status === 'Paid') {
      throw new Error('This appointment has already been paid for.');
    }

    const customer = await Customer.findById(customerId).session(session);
    if (!customer) throw new Error('Customer not found');
    const customerGender = customer.gender || 'other';

    // --- 4. INVENTORY LOGIC ---
    let allInventoryUpdates: InventoryUpdate[] = [];
    let lowStockProducts: IProduct[] = [];

    const serviceIds = appointment.serviceIds.map((s: any) => s._id.toString());
    if (serviceIds.length > 0) {
      const { totalUpdates: serviceProductUpdates } = await InventoryManager.calculateMultipleServicesInventoryImpact(
        serviceIds, customerGender
      );
      allInventoryUpdates.push(...serviceProductUpdates);
    }
    
    const retailProductUpdates: InventoryUpdate[] = productItemsToBill.map((item: any) => ({
      productId: item.itemId, productName: item.name,
      quantityToDeduct: item.quantity, unit: 'piece',
    }));
    allInventoryUpdates.push(...retailProductUpdates);

    if (allInventoryUpdates.length > 0) {
      const inventoryUpdateResult = await InventoryManager.applyInventoryUpdates(allInventoryUpdates, session);
      if (inventoryUpdateResult.success) {
        lowStockProducts = inventoryUpdateResult.lowStockProducts;
      } else {
        throw new Error('One or more inventory updates failed: ' + JSON.stringify(inventoryUpdateResult.errors));
      }
    }

    // --- 5. CREATE INVOICE ---
    const invoice = new Invoice({
      appointmentId, customerId, stylistId, billingStaffId, lineItems: items,
      serviceTotal, productTotal, subtotal, membershipDiscount, grandTotal,
      paymentDetails, notes, customerWasMember, membershipGrantedDuringBilling,
      paymentStatus: 'Paid',
      manualDiscount: {
        type: manualDiscountType || null, value: manualDiscountValue || 0,
        appliedAmount: finalManualDiscountApplied || 0,
      }
    });
    await invoice.save({ session });
    console.log('Created invoice with ID:', invoice._id);

    // --- 6. UPDATE APPOINTMENT ---
    await Appointment.updateOne({ _id: appointmentId }, {
      amount: subtotal, membershipDiscount, finalAmount: grandTotal,
      paymentDetails, billingStaffId, invoiceId: invoice._id, status: 'Paid',
    }, { session });
    console.log('Updated appointment to Paid status');

    // --- 7. LOYALTY POINTS LOGIC ---
    const loyaltySettingDoc = await Setting.findOne({ key: 'loyalty' }).session(session);
    if (loyaltySettingDoc?.value && grandTotal > 0) {
        const { rupeesForPoints, pointsAwarded: awarded } = loyaltySettingDoc.value;
        if (rupeesForPoints > 0 && awarded > 0) {
            pointsEarned = Math.floor(grandTotal / rupeesForPoints) * awarded;
            if (pointsEarned > 0) {
                await LoyaltyTransaction.create([{
                    customerId, points: pointsEarned, type: 'Credit',
                    description: `Earned from an invoice`,
                    reason: `Invoice`, transactionDate: new Date(),
                }], { session });
                console.log(`Credited ${pointsEarned} loyalty points.`);
            }
        }
    }

    // --- 8. UPDATE STYLIST ---
    await Stylist.updateOne({ _id: stylistId }, {
      isAvailable: true, currentAppointmentId: null,
      lastAvailabilityChange: new Date(),
    }, { session });
    console.log('Unlocked stylist');

    // --- 9. COMMIT TRANSACTION ---
    await session.commitTransaction();
    console.log("--- TRANSACTION COMMITTED SUCCESSFULLY ---");

    // --- 10. POST-TRANSACTION ACTIONS (SEND WHATSAPP MESSAGE) ---
    if (customer && customer.phoneNumber) {
        try {
            // FIXED: Get billing staff name from User model (billing staff are Users, not Staff)
            let billingStaffName = 'Staff Member';

            console.log('=== STAFF LOOKUP DEBUG ===');
            console.log('billingStaffId:', billingStaffId);

            if (billingStaffId && mongoose.Types.ObjectId.isValid(billingStaffId)) {
                try {
                    console.log('Searching in User model for billing staff ID:', billingStaffId);
                    const billingUser = await User.findById(billingStaffId, 'name').exec();
                    console.log('User model result:', billingUser);
                    
                    if (billingUser && billingUser.name) {
                        billingStaffName = billingUser.name;
                        console.log('✅ Found billing staff name in User model:', billingStaffName);
                    } else {
                        console.warn('❌ Billing staff not found in User model for ID:', billingStaffId);
                    }
                } catch (userError) {
                    console.error('❌ Error finding billing staff in User model:', userError);
                }
            } else {
                console.warn('❌ Invalid billingStaffId provided:', billingStaffId);
            }

            console.log('Final billing staff name:', billingStaffName);
            console.log('=== END STAFF LOOKUP DEBUG ===');


            // Safe decryption helper function
            function safeDecrypt(data: string, fieldName: string): string {
                if (!data) return '';
                if (!/^[0-9a-fA-F]{32,}/.test(data)) {
                    console.log(`Using plain text for ${fieldName}`);
                    return data;
                }
                
                try {
                    const decrypted = decrypt(data);
                    console.log(`Successfully decrypted ${fieldName}`);
                    return decrypted;
                } catch (e: any) {
                    console.warn(`Decryption failed for ${fieldName}: ${e.message}. Using as plain text.`);
                    return data;
                }
            }

            const decryptedPhone = safeDecrypt(customer.phoneNumber, 'phoneNumber');
            const decryptedName = safeDecrypt(customer.name, 'name');

            const cleanPhone = decryptedPhone.replace(/\D/g, '');
            console.log(`Processing phone number: ${cleanPhone} (length: ${cleanPhone.length})`);
            
            if (cleanPhone.length >= 10) {
                // Format services with COMMAS (NO \n newlines allowed!)
                const serviceItems = items.filter((item: any) => item.itemType === 'service' || item.itemType === 'fee');
                const servicesText = serviceItems.length > 0 
                    ? serviceItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ')
                    : '';

                // Format products with COMMAS (NO \n newlines allowed!)
                const productItems = items.filter((item: any) => item.itemType === 'product');
                const productsText = productItems.length > 0 
                    ? productItems.map((item: any) => `${item.name} x${item.quantity} = ₹${item.finalPrice.toFixed(0)}`).join(', ')
                    : '';

                // Calculate discounts applied
                const totalDiscountAmount = (membershipDiscount || 0) + (finalManualDiscountApplied || 0);
                const discountsText = totalDiscountAmount > 0 
                    ? `₹${totalDiscountAmount.toFixed(0)} saved`
                    : '';

                // FIXED: Format payment method WITHOUT amount (method names only)
                const paymentSummary = Object.entries(paymentDetails)
                    .filter(([_, amount]) => Number(amount) > 0)
                    .map(([method, _]) => method.charAt(0).toUpperCase() + method.slice(1))
                    .join(', ');

                console.log('Sending WhatsApp billing confirmation with billing_ff template');
                console.log('WhatsApp data preview:', {
                    customerName: decryptedName,
                    servicesPreview: servicesText.substring(0, 50) + '...',
                    productsPreview: productsText.substring(0, 30) + '...',
                    finalAmount: `₹${grandTotal.toFixed(0)}`,
                    discountsText,
                    paymentMethodOnly: paymentSummary, // Now shows only method names
                    staffName: billingStaffName, // Should now show actual name from User model
                    loyaltyPoints: `${pointsEarned} points`
                });

                await whatsAppService.sendBillingConfirmation({
                    phoneNumber: cleanPhone,
                    customerName: decryptedName,
                    servicesDetails: servicesText,
                    productsDetails: productsText,
                    finalAmount: `₹${grandTotal.toFixed(0)}`,
                    discountsApplied: discountsText,
                    paymentMethod: paymentSummary, // Just method names, no amounts
                    staffName: billingStaffName,
                    loyaltyPoints: `${pointsEarned} points`,
                });

                console.log('WhatsApp billing confirmation sent successfully with billing_ff template');
            } else {
                console.warn(`Invalid phone number: '${cleanPhone}' (length: ${cleanPhone.length}), skipping WhatsApp notification`);
            }
        } catch (whatsappError: any) {
            console.error('Failed to send WhatsApp billing confirmation:', whatsappError?.message || 'Unknown WhatsApp error');
            console.error('Full WhatsApp error:', whatsappError);
        }
    } else {
        console.warn("No customer phone number found. Skipping billing confirmation message.");
    }
    
    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully!',
      invoiceId: invoice._id,
    });

  } catch (error: any) {
    console.error('--- BILLING TRANSACTION FAILED, ROLLING BACK ---', error);
    await session.abortTransaction();
    return NextResponse.json({ success: false, message: error.message || 'Failed to process payment' }, { status: 400 });
  
  } finally {
    session.endSession();
  }
}