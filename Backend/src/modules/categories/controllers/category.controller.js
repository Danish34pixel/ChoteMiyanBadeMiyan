import { getCatalogRuntime } from '../../catalog-runtime.js';

export async function listCategories(req, res) {
  const result = await getCatalogRuntime().categoryService.list(
    req.validatedQuery,
    true,
  );
  res.status(200).json({ success: true, data: result });
}

export async function getCategory(req, res) {
  const category = await getCatalogRuntime().categoryService.getPublicBySlug(
    req.params.slug,
  );
  res.status(200).json({ success: true, data: { category } });
}

export async function listAdminCategories(req, res) {
  const result = await getCatalogRuntime().categoryService.list(
    req.validatedQuery,
  );
  res.status(200).json({ success: true, data: result });
}

export async function createCategory(req, res) {
  const category = await getCatalogRuntime().categoryService.create(req.body);
  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: { category },
  });
}

export async function updateCategory(req, res) {
  const category = await getCatalogRuntime().categoryService.update(
    req.params.categoryId,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: { category },
  });
}

export async function deleteCategory(req, res) {
  const result = await getCatalogRuntime().categoryService.remove(
    req.params.categoryId,
  );
  res.status(200).json({
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
}
