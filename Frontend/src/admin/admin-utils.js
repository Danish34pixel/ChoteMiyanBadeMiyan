import { API_BASE_URL } from '../lib/api.js';

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

export function localImageUrl(url) {
  if (!url?.startsWith('/uploads/')) return url ?? '';
  return `${new URL(API_BASE_URL).origin}${url}`;
}

export function productStock(product) {
  if (product.variants?.length) {
    return product.variants.reduce((total, variant) => total + variant.stock, 0);
  }
  return product.stock ?? 0;
}

export function productStockState(product) {
  if (product.variants?.length) {
    const stocks = product.variants.map((variant) => variant.stock);
    if (stocks.every((stock) => stock === 0)) return 'out';
    if (
      product.variants.some(
        (variant) =>
          variant.stock > 0 && variant.stock <= variant.lowStockThreshold,
      )
    ) {
      return 'low';
    }
    return 'in';
  }
  if (!product.stock) return 'out';
  return product.stock <= product.lowStockThreshold ? 'low' : 'in';
}

export async function fetchAllProducts(adminRequest) {
  const products = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const response = await adminRequest(
      `/admin/products?page=${page}&limit=100`,
    );
    products.push(...response.data.products);
    pages = response.data.pagination.pages;
    page += 1;
  }
  return products;
}

export async function fetchAllCategories(adminRequest) {
  const categories = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const response = await adminRequest(
      `/admin/categories?page=${page}&limit=100`,
    );
    categories.push(...response.data.categories);
    pages = response.data.pagination.pages;
    page += 1;
  }
  return categories;
}
