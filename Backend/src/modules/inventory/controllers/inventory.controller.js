import { getCatalogRuntime } from '../../catalog-runtime.js';

export async function adjustInventory(req, res) {
  const adjustment = await getCatalogRuntime().inventoryService.adjust(
    req.body,
    req.auth.userId,
  );
  res.status(201).json({
    success: true,
    message: 'Inventory adjusted successfully',
    data: { adjustment },
  });
}

export async function listInventoryHistory(req, res) {
  const result = await getCatalogRuntime().inventoryService.listHistory(
    req.validatedQuery,
  );
  res.status(200).json({ success: true, data: result });
}
