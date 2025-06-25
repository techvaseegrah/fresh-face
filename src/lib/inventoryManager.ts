// lib/inventoryManager.ts
import Product from '@/models/Product';
import ServiceItem, { IServiceItem } from '@/models/ServiceItem';
import mongoose from 'mongoose';

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
    try {
      const service = await ServiceItem.findById(serviceId).populate('consumables.product');
      
      if (!service || !service.consumables || service.consumables.length === 0) {
        console.log(`No consumables found for service ${serviceId}`);
        return [];
      }

      const updates: InventoryUpdate[] = [];

      for (const consumable of service.consumables) {
        const product = consumable.product;
        if (!product || typeof product === 'string') {
          console.log('Skipping consumable - product not populated');
          continue;
        }

        // Get the appropriate quantity based on gender
        let quantityToUse = consumable.quantity.default || 0;
        
        if (customerGender === 'male' && typeof consumable.quantity.male === 'number') {
          quantityToUse = consumable.quantity.male;
          console.log(`Using male quantity: ${quantityToUse} for product ${product.name}`);
        } else if (customerGender === 'female' && typeof consumable.quantity.female === 'number') {
          quantityToUse = consumable.quantity.female;
          console.log(`Using female quantity: ${quantityToUse} for product ${product.name}`);
        } else {
          console.log(`Using default quantity: ${quantityToUse} for product ${product.name}`);
        }

        // IMPORTANT: Use the quantity specified in the service consumable, NOT the product's quantityPerItem
        updates.push({
          productId: product._id.toString(),
          productName: product.name,
          quantityToDeduct: quantityToUse, // This should be the service's consumable quantity (e.g., 40ml)
          unit: consumable.unit || product.unit
        });

        console.log(`Inventory update prepared: ${product.name} - ${quantityToUse}${consumable.unit}`);
      }

      return updates;
    } catch (error) {
      console.error('Error calculating service inventory usage:', error);
      return [];
    }
  }

  static async applyInventoryUpdates(updates: InventoryUpdate[]): Promise<{
    success: boolean;
    errors: string[];
    updatedProducts: any[];
    restockAlerts: { productId: string; productName: string; currentQuantity: number; unit: string }[];
  }> {
    const errors: string[] = [];
    const restockAlerts: any[] = [];
    const updatedProducts: any[] = [];

    for (const update of updates) {
      try {
        console.log(`Processing inventory update for product ${update.productId}: -${update.quantityToDeduct} units`);
        
        const product = await Product.findById(update.productId);
        if (!product) {
          errors.push(`Product ${update.productId} not found`);
          continue;
        }

        console.log(`Current inventory for ${product.name}: ${product.totalQuantity}${product.unit}`);

        // Check if we have sufficient inventory
        if (product.totalQuantity < update.quantityToDeduct) {
          errors.push(
            `Insufficient inventory for ${product.name}. ` +
            `Available: ${product.totalQuantity}${product.unit}, ` +
            `Required: ${update.quantityToDeduct}${update.unit}`
          );
          continue;
        }

        // Deduct from total quantity - THIS IS THE KEY FIX
        const previousQuantity = product.totalQuantity;
        product.totalQuantity = product.totalQuantity - update.quantityToDeduct;
        
        console.log(`Updated inventory for ${product.name}: ${previousQuantity}${product.unit} → ${product.totalQuantity}${product.unit}`);

        // Recalculate number of items based on remaining total quantity
        if (product.quantityPerItem > 0) {
          const previousItems = product.numberOfItems;
          product.numberOfItems = Math.floor(product.totalQuantity / product.quantityPerItem);
          console.log(`Updated item count: ${previousItems} → ${product.numberOfItems}`);
        }

        await product.save();

        updatedProducts.push({
          productId: product._id,
          productName: product.name,
          previousQuantity,
          newQuantity: product.totalQuantity,
          deducted: update.quantityToDeduct,
          unit: product.unit
        });

        // Check for low stock based on initial capacity
        const initialCapacity = product.numberOfItems * product.quantityPerItem + product.totalQuantity;
        const percentageRemaining = (product.totalQuantity / initialCapacity) * 100;
        
        if (percentageRemaining <= 20) {
          restockAlerts.push({
            productId: product._id,
            productName: product.name,
            currentQuantity: product.totalQuantity,
            unit: product.unit,
            percentageRemaining
          });
        }
      } catch (error) {
        console.error(`Error updating inventory for product ${update.productId}:`, error);
        errors.push(`Failed to update inventory for product ${update.productId}: ${error.message}`);
      }
    }

    console.log('Inventory update complete:', {
      totalUpdates: updates.length,
      successful: updatedProducts.length,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      errors,
      updatedProducts,
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

    console.log(`Calculating inventory impact for ${serviceIds.length} services, customer gender: ${customerGender}`);

    // Calculate total usage across all services
    for (const serviceId of serviceIds) {
      const updates = await this.calculateServiceInventoryUsage(serviceId, customerGender);
      
      for (const update of updates) {
        const existingUpdate = consolidatedUpdates.get(update.productId);
        if (existingUpdate) {
          existingUpdate.quantityToDeduct += update.quantityToDeduct;
          console.log(`Consolidated usage for ${update.productName}: ${existingUpdate.quantityToDeduct}${update.unit}`);
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
      const initialCapacity = product.numberOfItems * product.quantityPerItem;
      const percentageRemaining = initialCapacity > 0 ? (remainingAfterUsage / initialCapacity) * 100 : 0;

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

      console.log(`Impact for ${product.name}: ${product.totalQuantity} - ${update.quantityToDeduct} = ${remainingAfterUsage} ${product.unit} (${alertLevel})`);
    }

    return {
      impactSummary,
      totalUpdates: Array.from(consolidatedUpdates.values())
    };
  }
}