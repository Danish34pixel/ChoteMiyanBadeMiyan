import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  fetchAllCategories,
  localImageUrl,
  productStock,
  productStockState,
} from '../../admin/admin-utils.js';

const pageSize = 20;

function ProductStatus({ status }) {
  return <span className={`admin-status-pill status-${status}`}>{status}</span>;
}

function InventoryDialog({ product, onClose, onSaved }) {
  const { adminRequest } = useAuth();
  const [variantId, setVariantId] = useState(product.variants?.[0]?._id ?? '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const variants = product.variants ?? [];
  const selectedVariant = variants.find((variant) => variant._id === variantId);
  const currentStock = selectedVariant?.stock ?? product.stock ?? 0;

  useEffect(() => {
    setQuantity(String(currentStock));
  }, [currentStock]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const nextStock = Number(quantity);
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      setError('Enter a non-negative whole-number quantity.');
      return;
    }
    if (nextStock === currentStock) {
      setError('Enter a quantity different from the current stock.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Add a reason for this inventory adjustment.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminRequest('/admin/inventory/adjustments', {
        method: 'POST',
        body: {
          productId: product._id,
          ...(selectedVariant ? { variantId: selectedVariant._id } : {}),
          delta: nextStock - currentStock,
          reason: reason.trim(),
        },
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Could not adjust inventory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
        <button className="admin-modal-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        <span className="admin-modal-icon"><Warehouse size={20} /></span>
        <span className="eyebrow">STOCK ADJUSTMENT</span>
        <h2 id="inventory-title">Update inventory</h2>
        <p className="admin-modal-description">{product.name}</p>
        <form className="admin-form" onSubmit={save}>
          {variants.length > 0 && (
            <label className="admin-field">
              <span>Variant</span>
              <select value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                {variants.map((variant) => (
                  <option key={variant._id} value={variant._id}>
                    {variant.sku} · {Object.values(variant.attributes ?? {}).join(' / ')} · {variant.stock} in stock
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="admin-field">
            <span>New quantity <small>(currently {currentStock})</small></span>
            <input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </label>
          <label className="admin-field">
            <span>Reason</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Restock received" minLength={3} maxLength={500} required />
          </label>
          {error && <p className="admin-inline-error" role="alert">{error}</p>}
          <button className="admin-button admin-button-primary admin-button-full" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="admin-spin" size={16} /> : <Warehouse size={16} />}
            {saving ? 'Saving adjustment…' : 'Save stock adjustment'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AdminProductsPage() {
  const { adminRequest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [inventoryProduct, setInventoryProduct] = useState(null);
  const page = Number(searchParams.get('page')) || 1;
  const query = searchParams.get('q') ?? '';

  const updateQuery = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (Object.hasOwn(updates, 'page') === false) next.set('page', '1');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (query) params.set('q', query);
    if (status) params.set('status', status);

    Promise.all([
      adminRequest(`/admin/products?${params}`),
      fetchAllCategories(adminRequest),
    ])
      .then(([response, allCategories]) => {
        if (!active) return;
        setProducts(response.data.products);
        setPagination(response.data.pagination);
        setCategories(allCategories);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load products.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [adminRequest, page, query, status, reload]);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  const pageLabel = useMemo(() => {
    if (!pagination.total) return 'No products found';
    const first = (page - 1) * pageSize + 1;
    return `Showing ${first}–${Math.min(first + products.length - 1, pagination.total)} of ${pagination.total}`;
  }, [page, pagination.total, products.length]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [String(category._id), category])),
    [categories],
  );

  async function deleteProduct(product) {
    if (!window.confirm(`Deactivate “${product.name}”? It will no longer appear in the storefront.`)) return;
    setError('');
    try {
      await adminRequest(`/admin/products/${product._id}`, { method: 'DELETE' });
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(requestError.message || 'Could not deactivate this product.');
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    updateQuery({ q: queryInput.trim() });
  }

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">YOUR CATALOG</span>
          <h1>Products</h1>
          <p>Manage your store’s products, pricing and inventory.</p>
        </div>
        <Link className="admin-button admin-button-primary" to="/admin/products/new">
          <Plus size={17} /> Add product
        </Link>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          <CircleAlert size={18} /><span>{error}</span>
          <button type="button" onClick={() => setReload((count) => count + 1)}>Retry</button>
        </div>
      )}

      <section className="admin-panel admin-table-panel">
        <div className="admin-toolbar">
          <form className="admin-search-form" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              aria-label="Search products by name or SKU"
              placeholder="Search products or SKU…"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
            />
            {queryInput && (
              <button type="button" aria-label="Clear search" onClick={() => {
                setQueryInput('');
                updateQuery({ q: '' });
              }}><X size={15} /></button>
            )}
          </form>
          <label className="admin-filter-control">
            <SlidersHorizontal size={16} />
            <span>Status</span>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                updateQuery({ status: event.target.value });
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="admin-table-message" colSpan="7"><LoaderCircle className="admin-spin" size={19} /> Loading products…</td></tr>
              ) : products.length ? products.map((product) => (
                <tr key={product._id}>
                  <td>
                    <div className="admin-product-cell">
                      <span className="admin-product-thumb">
                        {product.images?.[0]?.url
                          ? <img src={localImageUrl(product.images[0].url)} alt="" />
                          : <ImageIcon size={18} />}
                      </span>
                      <span className="admin-product-cell-copy">
                        <strong>{product.name}</strong>
                        <small>{product.slug}</small>
                      </span>
                    </div>
                  </td>
                  <td className="admin-mono">{product.sku || `${product.variants?.length ?? 0} variants`}</td>
                  <td>
                    <span className="admin-category-cell">
                      {categoryById.get(String(product.subcategoryId ?? ''))?.name
                        || categoryById.get(String(product.categoryId ?? ''))?.name
                        || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-price">₹{Number(product.sellingPrice).toLocaleString('en-IN')}</span>
                    {product.variants?.length > 0 && <small className="admin-table-subtext">From variant pricing</small>}
                  </td>
                  <td>
                    <button className={`admin-stock-value stock-${productStockState(product)}`} type="button" onClick={() => setInventoryProduct(product)}>
                      {productStock(product)} <Warehouse size={14} />
                    </button>
                  </td>
                  <td><ProductStatus status={product.status} /></td>
                  <td>
                    <div className="admin-row-actions">
                      <Link className="admin-icon-button" to={`/admin/products/${product._id}/edit`} aria-label={`Edit ${product.name}`} title="Edit product"><Edit3 size={16} /></Link>
                      <button className="admin-icon-button admin-icon-danger" type="button" onClick={() => deleteProduct(product)} aria-label={`Deactivate ${product.name}`} title="Deactivate product"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="admin-table-empty" colSpan="7">
                    <PackageEmpty />
                    <strong>No products match those filters</strong>
                    <span>Try a different search, or add a new product.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination">
          <span>{loading ? 'Loading…' : pageLabel}</span>
          <div className="admin-pagination-actions">
            <button type="button" disabled={loading || page <= 1} onClick={() => updateQuery({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft size={17} /></button>
            <span>Page {pagination.page || page} of {Math.max(pagination.pages, 1)}</span>
            <button type="button" disabled={loading || page >= pagination.pages} onClick={() => updateQuery({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={17} /></button>
          </div>
        </div>
      </section>
      {inventoryProduct && (
        <InventoryDialog
          product={inventoryProduct}
          onClose={() => setInventoryProduct(null)}
          onSaved={() => {
            setInventoryProduct(null);
            setReload((count) => count + 1);
          }}
        />
      )}
    </div>
  );
}

function PackageEmpty() {
  return <span className="admin-empty-icon"><AlertTriangle size={20} /></span>;
}
