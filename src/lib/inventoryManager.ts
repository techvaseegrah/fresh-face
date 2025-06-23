// lib/inventoryManager.ts
import Product from '@/models/Product';
import ServiceItem, { IServiceItem } from '@/models/ServiceItem';
import mongoose from 'mongoose';

export interface InventoryUpdate {
  productId: string;
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
    customerGender: 'male' | 'female' | 'other' = 'other'
  ): Promise<InventoryUpdate[]> {
    const service = await ServiceItem.findById(serviceId).populate('consumables.product');
    if (!service || !service.consumables || service.consumables.length === 0) {
      return [];
    }

    const updates: InventoryUpdate[] = [];

    for (const consumable of service.consumables) {
      const product = consumable.product;
      if (!product || typeof product === 'string') continue;

      // Get the appropriate quantity based on gender
      let quantityToUse = consumable.quantity.default;

      if (customerGender === 'male' && consumable.quantity.male !== undefined) {
        quantityToUse = consumable.quantity.male;
      } else if (customerGender === 'female' && consumable.quantity.female !== undefined) {
        quantityToUse = consumable.quantity.female;
      }

      updates.push({
        productId: product._id.toString(),
        quantityToDeduct: quantityToUse,
        unit: consumable.unit || product.unit
      });
    }

    return updates;
  }

  static async applyInventoryUpdates(updates: InventoryUpdate[]): Promise<{
    success: boolean;
    errors: string[];
    restockAlerts: { productId: string; productName: string; currentQuantity: number; unit: string }[];
  }> {
    const errors: string[] = [];
    const restockAlerts: any[] = [];

    for (const update of updates) {
      try {
        const product = await Product.findById(update.productId);
        if (!product) {
          errors.push(`Product ${update.productId} not found`);
          continue;
        }

        // Check if we have sufficient inventory
        if (product.totalQuantity < update.quantityToDeduct) {
          errors.push(
            `Insufficient inventory for ${product.name}. ` +
            `Available: ${product.totalQuantity}${product.unit}, ` +
            `Required: ${update.quantityToDeduct}${update.unit}`
          );
          continue;
        }

        // Deduct from total quantity
        product.totalQuantity -= update.quantityToDeduct;

        // Recalculate number of items if needed
        if (product.quantityPerItem > 0) {
          product.numberOfItems = Math.floor(product.totalQuantity / product.quantityPerItem);
        }

        await product.save();

        // Check for low stock
        const percentageRemaining = (product.totalQuantity / (product.numberOfItems * product.quantityPerItem)) * 100;
        if (percentageRemaining <= 20) {
          restockAlerts.push({
            productId: product._id,
            productName: product.name,
            currentQuantity: product.totalQuantity,
            unit: product.unit
          });
        }
      } catch (error) {
        errors.push(`Failed to update inventory for product ${update.productId}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      restockAlerts
    };
  }

  static async calculateMultipleServicesInventoryImpact(
    serviceIds: string[],
    customerGender: 'male' | 'female' | 'other' = 'other'
  ): Promise<{
    impactSummary: InventoryImpact[];
    totalUpdates: InventoryUpdate[];
  }> {
    const consolidatedUpdates = new Map<string, InventoryUpdate>();

    // Calculate total usage across all services
    for (const serviceId of serviceIds) {
      const updates = await this.calculateServiceInventoryUsage(serviceId, customerGender);

      for (const update of updates) {
        const existingUpdate = consolidatedUpdates.get(update.productId);
        if (existingUpdate) {
          existingUpdate.quantityToDeduct += update.quantityToDeduct;
        } else {
          consolidatedUpdates.set(update.productId, { ...update });
        }
      }
    }

    // Calculate impact for each product
    const impactSummary: InventoryImpact[] = [];

    for (const [productId, update] of consolidatedUpdates) {
      const product = await Product.findById(productId);
      if (!product) continue;

      const remainingAfterUsage = product.totalQuantity - update.quantityToDeduct;
      const originalCapacity = product.numberOfItems * product.quantityPerItem;
      const percentageRemaining = originalCapacity > 0 ? (remainingAfterUsage / originalCapacity) * 100 : 0;

      let alertLevel: 'ok' | 'low' | 'critical' | 'insufficient' = 'ok';
      if (remainingAfterUsage < 0) {
        alertLevel = 'insufficient';
      } else if (percentageRemaining <= 10) {
        alertLevel = 'critical';
      } else if (percentageRemaining <= 20) {
        alertLevel = 'low';
      }

      impactSummary.push({
        productId: product._id.toString(),
        productName: product.name,
        currentQuantity: product.totalQuantity,
        usageQuantity: update.quantityToDeduct,
        remainingAfterUsage,
        unit: product.unit,
        alertLevel
      });
    }

    return {
      impactSummary,
      totalUpdates: Array.from(consolidatedUpdates.values())
    };
  }
}