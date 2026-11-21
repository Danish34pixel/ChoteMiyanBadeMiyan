import { getCatalogRuntime } from '../../catalog-runtime.js';

export async function listProducts(req, res) {
  const result = await getCatalogRuntime().productService.listPublic(
    req.validatedQuery,
  );
  res.status(200).json({ success: true, data: result });
}

export async function getProduct(req, res) {
  const product = await getCatalogRuntime().productService.getPublicBySlug(
    req.params.slug,
  );
  res.status(200).json({ success: true, data: { product } });
}

export async function listAdminProducts(req, res) {
  const result = await getCatalogRuntime().productService.listAdmin(
    req.validatedQuery,
  );
  res.status(200).json({ success: true, data: result });
}

export async function createProduct(req, res) {
  const product = await getCatalogRuntime().productService.create(
    req.body,
    req.auth.userId,
  );
  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: { product },
  });
}

export async function updateProduct(req, res) {
  const product = await getCatalogRuntime().productService.update(
    req.params.productId,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: { product },
  });
}

export async function addProductVariant(req, res) {
  const variant = await getCatalogRuntime().productService.addVariant(
    req.params.productId,
    req.body,
    req.auth.userId,
  );
  res.status(201).json({
    success: true,
    message: 'Product variant created successfully',
    data: { variant },
  });
}

export async function updateProductVariant(req, res) {
  const variant = await getCatalogRuntime().productService.updateVariant(
    req.params.productId,
    req.params.variantId,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: 'Product variant updated successfully',
    data: { variant },
  });
}

export async function deleteProductVariant(req, res) {
  const result = await getCatalogRuntime().productService.removeVariant(
    req.params.productId,
    req.params.variantId,
  );
  res.status(200).json({
    success: true,
    message: 'Product variant deleted successfully',
    data: result,
  });
}

export async function deleteProduct(req, res) {
  const result = await getCatalogRuntime().productService.remove(
    req.params.productId,
  );
  res.status(200).json({
    success: true,
    message: 'Product deactivated successfully',
    data: result,
  });
}
