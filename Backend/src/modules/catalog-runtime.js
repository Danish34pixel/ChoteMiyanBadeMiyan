import Category from './categories/models/category.model.js';
import { createCategoryService } from './categories/services/category.service.js';
import Product from './products/models/product.model.js';
import { createProductService } from './products/services/product.service.js';
import InventoryAdjustment from './inventory/models/inventory-adjustment.model.js';
import { createInventoryService } from './inventory/services/inventory.service.js';

let runtime;

export function getCatalogRuntime() {
  if (!runtime) {
    runtime = {
      categoryService: createCategoryService({
        categoryModel: Category,
        productModel: Product,
      }),
      productService: createProductService({
        productModel: Product,
        categoryModel: Category,
        inventoryAdjustmentModel: InventoryAdjustment,
      }),
      inventoryService: createInventoryService({
        productModel: Product,
        adjustmentModel: InventoryAdjustment,
      }),
    };
  }
  return runtime;
}

export function resetCatalogRuntimeForTests() {
  runtime = undefined;
}
