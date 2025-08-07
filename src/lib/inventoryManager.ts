// FILE: src/lib/inventoryManager.ts - MULTI-TENANT REFACTORED VERSION

import mongoose from 'mongoose';
import Product, { IProduct } from '@/models/Product';
import ServiceItem from '@/models/ServiceItem';
import Setting from '@/models/Setting';
import { Gender } from '@/types/gender';

export interface InventoryUpdate {
  productId: string;
  productName?: string;
  quantityToDeduct: number;
  unit: string;
}

export interface InventoryImpact {
  productId: string;
  productName: string;
  currentQuantity: number;
  usageQuantity: number;
  remainingAfterUsage: number;
  unit: string;
  alertLevel: 'ok' | 'low' | 'critical' | 'insufficient';
}

export class InventoryManager {
  static async calculateServiceInventoryUsage(
    serviceId: string,
    customerGender: 'male' | 'female' | 'other' = 'other',
    tenantId: string // --- MT: Add tenantId
  ): Promise<InventoryUpdate[]> {
    // --- MT: Scope the ServiceItem query by tenantId
    const service = await ServiceItem.findOne({ _id: serviceId, tenantId }).populate('consumables.product', 'name sku unit');
    if (!service || !service.consumables?.length) return [];

    return service.consumables.map(consumable => {
      const product = consumable.product as IProduct;
      let quantityToUse = consumable.quantity.default || 0;
      if (customerGender === Gender.Male && typeof consumable.quantity.male === 'number') {
        quantityToUse = consumable.quantity.male;
      } else if (customerGender === Gender.Female && typeof consumable.quantity.female === 'number') {
        quantityToUse = consumable.quantity.female;
      }

      return {
        productId: product._id.toString(),
        productName: product.name,
        quantityToDeduct: quantityToUse,
        unit: consumable.unit || product.unit,
      };
    });
  }

  static async applyInventoryUpdates(
    updates: InventoryUpdate[],
    session: mongoose.ClientSession | undefined,
    tenantId: string // --- MT: Add tenantId
  ): Promise<{
    success: boolean;
    errors: string[];
    lowStockProducts: IProduct[];
  }> {
    
   const updatePromises = updates.map(async (update) => {
  
      // --- MT: Scope product lookup by tenantId
      const product = await Product.findOne({ _id: update.productId, tenantId }).session(session);
      if (!product) {
        throw new Error(`Product with ID ${update.productId} not found for this tenant during inventory update.`);
      }

      if (update.unit === 'piece') {
        const newNumberOfItems = product.numberOfItems - update.quantityToDeduct;
        const newTotalQuantity = newNumberOfItems * product.quantityPerItem;

        // --- MT: Scope the update query by tenantId
        return Product.updateOne(
          { _id: update.productId, tenantId },
          { 
            $set: { 
              numberOfItems: newNumberOfItems, 
              totalQuantity: newTotalQuantity 
            } 
          },
          { session }
        );
      } 
      else {
        // --- MT: Scope the update query by tenantId
        return Product.updateOne(
          { _id: update.productId, tenantId },
          { $inc: { totalQuantity: -update.quantityToDeduct } },
          { session }
        );
      }
    });

    await Promise.all(updatePromises);

    const lowStockProducts: IProduct[] = [];
    const productIds = updates.map(u => u.productId);

    // --- MT: Scope the final check by tenantId
    const updatedProducts = await Product.find({ _id: { $in: productIds }, tenantId })
      .select('name numberOfItems lowStockThreshold')
      .session(session);

    for (const product of updatedProducts) {
      if (product.numberOfItems > 0 && product.numberOfItems <= product.lowStockThreshold) {
        lowStockProducts.push(product);
      }
    }

    return {
      success: true,
      errors: [],
      lowStockProducts
    };
  }


  static async calculateMultipleServicesInventoryImpact(
    serviceIds: string[],
    customerGender: 'male' | 'female' | 'other' = 'other',
    tenantId: string // --- MT: Add tenantId
  ): Promise<{ impactSummary: InventoryImpact[], totalUpdates: InventoryUpdate[] }> {
    const consolidatedUpdates = new Map<string, InventoryUpdate>();

    for (const serviceId of serviceIds) {
      // --- MT: Pass tenantId down to the next method
      const updates = await this.calculateServiceInventoryUsage(serviceId, customerGender, tenantId);
      for (const update of updates) {
        const existing = consolidatedUpdates.get(update.productId);
        if (existing) {
          existing.quantityToDeduct += update.quantityToDeduct;
        } else {
          consolidatedUpdates.set(update.productId, { ...update });
        }
      }
    }

    const impactSummary: InventoryImpact[] = [];
    for (const [productId, update] of consolidatedUpdates) {
      // --- MT: Scope product lookup by tenantId
      const product = await Product.findOne({ _id: productId, tenantId });
      if (!product) continue;
      const isPiece = product.unit === 'piece';
      const current = isPiece ? product.numberOfItems : product.totalQuantity;
      const remaining = current - update.quantityToDeduct;
      const initialCapacity = product.numberOfItems * product.quantityPerItem;
      const percentageRemaining = initialCapacity > 0 ? ((isPiece ? remaining * product.quantityPerItem : remaining) / initialCapacity) * 100 : 0;

      let alertLevel: 'ok' | 'low' | 'critical' | 'insufficient' = 'ok';
      if (remaining < 0) alertLevel = 'insufficient';
      else if (percentageRemaining <= 10) alertLevel = 'critical';
      else if (percentageRemaining <= 20) alertLevel = 'low';

      impactSummary.push({
        productId: product._id.toString(),
        productName: product.name,
        currentQuantity: current,
        usageQuantity: update.quantityToDeduct,
        remainingAfterUsage: remaining,
        unit: product.unit,
        alertLevel,
      });
    }

    return {
      impactSummary,
      totalUpdates: Array.from(consolidatedUpdates.values()),
    };
  }
}