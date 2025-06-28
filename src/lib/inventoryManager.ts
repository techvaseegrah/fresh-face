// src/lib/inventoryManager.ts
import Product from '@/models/Product';
import ServiceItem from '@/models/ServiceItem';
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
    customerGender: 'male' | 'female' | 'other' = 'other'
  ): Promise<InventoryUpdate[]> {
    const service = await ServiceItem.findById(serviceId).populate('consumables.product', 'name sku unit');
    if (!service || !service.consumables?.length) return [];

    return service.consumables.map(consumable => {
      const product = consumable.product;
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

  static async applyInventoryUpdates(updates: InventoryUpdate[]): Promise<{
    success: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    for (const update of updates) {
      try {
        const product = await Product.findById(update.productId);
        if (!product) {
          errors.push(`Product with ID ${update.productId} not found.`);
          continue;
        }

        // --- NEW LOGIC ---
        if (product.unit === 'piece') {
          // Handle item-based deduction (decrement numberOfItems)
          if (product.numberOfItems < update.quantityToDeduct) {
            errors.push(`Insufficient stock for ${product.name}. Required: ${update.quantityToDeduct}, Available: ${product.numberOfItems}`);
            continue;
          }
          product.numberOfItems -= update.quantityToDeduct;
          product.totalQuantity = product.numberOfItems * product.quantityPerItem; // Recalculate total
        } else {
          // Handle unit-based deduction (decrement totalQuantity)
          if (product.totalQuantity < update.quantityToDeduct) {
            errors.push(`Insufficient stock for ${product.name}. Required: ${update.quantityToDeduct}${product.unit}, Available: ${product.totalQuantity}${product.unit}`);
            continue;
          }
          product.totalQuantity -= update.quantityToDeduct;
          console.log(`Updated total quantity for ${product.name}: ${product.totalQuantity}${product.unit}`);
          
          if (product.quantityPerItem > 0) {
            product.numberOfItems = Math.floor(product.totalQuantity / product.quantityPerItem);
          }
        }
        // --- END NEW LOGIC ---

        await product.save();

      } catch (error: any) {
        errors.push(`Failed to update product ${update.productName}: ${error.message}`);
      }
    }
    return { success: errors.length === 0, errors };
  }

  static async calculateMultipleServicesInventoryImpact(
    serviceIds: string[],
    customerGender: 'male' | 'female' | 'other' = 'other'
  ): Promise<{ impactSummary: InventoryImpact[], totalUpdates: InventoryUpdate[] }> {
    const consolidatedUpdates = new Map<string, InventoryUpdate>();

    for (const serviceId of serviceIds) {
      const updates = await this.calculateServiceInventoryUsage(serviceId, customerGender);
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
      const product = await Product.findById(productId);
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