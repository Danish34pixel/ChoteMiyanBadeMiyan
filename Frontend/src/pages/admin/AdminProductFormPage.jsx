import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ImagePlus,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchAllProducts, localImageUrl, slugify } from '../../admin/admin-utils.js';

const emptyVariant = () => ({
  id: '',
  sku: '',
  size: '',
  color: '',
  weight: '',
  other: '',
  originalPrice: '',
  sellingPrice: '',
  stock: '0',
  lowStockThreshold: '5',
  images: [],
});

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  sku: '',
  categoryId: '',
  subcategoryId: '',
  originalPrice: '',
  sellingPrice: '',
  stock: '0',
  lowStockThreshold: '5',
  status: 'active',
  featured: false,
  bestseller: false,
  images: [],
  variants: [],
};

function categoryName(category) {
  return category.name;
}

function categoryId(category) {
  return String(category._id ?? category.id);
}

function makeVariant(variant) {
  const attributes = Object.entries(variant.attributes ?? {});
  const known = (name) =>
    attributes.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? '';
  const other = attributes
    .filter(([key]) => !['size', 'color', 'weight'].includes(key.toLowerCase()))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  return {
    id: String(variant._id ?? ''),
    sku: variant.sku,
    size: known('size'),
    color: known('color'),
    weight: known('weight'),
    other,
    originalPrice: String(variant.originalPrice),
    sellingPrice: String(variant.sellingPrice),
    stock: String(variant.stock),
    lowStockThreshold: String(variant.lowStockThreshold ?? 5),
    images: variant.images ?? [],
  };
}

function variantAttributes(variant) {
  const attributes = {};
  if (variant.size.trim()) attributes.Size = variant.size.trim();
  if (variant.color.trim()) attributes.Color = variant.color.trim();
  if (variant.weight.trim()) attributes.Weight = variant.weight.trim();
  for (const line of variant.other.split('\n')) {
    const [key, ...parts] = line.split('=');
    if (key?.trim() && parts.join('=').trim()) {
      attributes[key.trim()] = parts.join('=').trim();
    }
  }
  return attributes;
}

function parseImages(images) {
  return images.map(({ url, alt = '' }) => ({
    url: localImageUrl(url.trim()),
    alt: alt.trim(),
  }));
}

function toVariantPayload(variant) {
  return {
    sku: variant.sku.trim(),
    attributes: variantAttributes(variant),
    originalPrice: Number(variant.originalPrice),
    sellingPrice: Number(variant.sellingPrice),
    stock: Number(variant.stock),
    lowStockThreshold: Number(variant.lowStockThreshold),
    images: parseImages(variant.images),
  };
}

export default function AdminProductFormPage() {
  const { productId } = useParams();
  const isEditing = Boolean(productId);
  const { adminRequest } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [originalProduct, setOriginalProduct] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(isEditing);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [categoryPages, productPages] = await Promise.all([
          adminRequest('/admin/categories?page=1&limit=100').then(async (first) => {
            const result = [...first.data.categories];
            for (let page = 2; page <= first.data.pagination.pages; page += 1) {
              const next = await adminRequest(`/admin/categories?page=${page}&limit=100`);
              result.push(...next.data.categories);
            }
            return result;
          }),
          isEditing ? fetchAllProducts(adminRequest) : Promise.resolve([]),
        ]);
        if (!active) return;
        setCategories(categoryPages);
        if (isEditing) {
          const product = productPages.find((item) => String(item._id) === productId);
          if (!product) throw new Error('Product not found in the admin catalog.');
          setOriginalProduct(product);
          const parentCategoryId = String(product.categoryId?._id ?? product.categoryId);
          setForm({
            ...emptyForm,
            name: product.name,
            slug: product.slug,
            description: product.description,
            sku: product.sku ?? '',
            categoryId: parentCategoryId,
            subcategoryId: product.subcategoryId
              ? String(product.subcategoryId?._id ?? product.subcategoryId)
              : '',
            originalPrice: String(product.originalPrice),
            sellingPrice: String(product.sellingPrice),
            stock: String(product.stock ?? 0),
            lowStockThreshold: String(product.lowStockThreshold ?? 5),
            status: product.status,
            featured: Boolean(product.featured),
            bestseller: Boolean(product.bestseller),
            images: product.images ?? [],
            variants: (product.variants ?? []).map(makeVariant),
          });
        } else if (categoryPages.length) {
          const firstParent = categoryPages.find((item) => !item.parentId);
          if (firstParent) {
            setForm((current) => ({ ...current, categoryId: categoryId(firstParent) }));
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Could not load product data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [adminRequest, isEditing, productId]);

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const subcategories = useMemo(
    () =>
      categories.filter(
        (category) => String(category.parentId ?? '') === form.categoryId,
      ),
    [categories, form.categoryId],
  );

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'categoryId' ? { subcategoryId: '' } : {}),
      ...(name === 'name' && !slugTouched ? { slug: slugify(value) } : {}),
    }));
  }

  function updateImage(index, field, value) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image,
      ),
    }));
  }

  function updateVariant(index, field, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  async function uploadFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const unsupported = files.find(
      (file) =>
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    );
    if (unsupported) {
      setError('Choose PNG, JPEG, or WebP images no larger than 5 MB each.');
      return;
    }
    if (form.images.length + files.length > 10) {
      setError('A product can have up to 10 images.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        const response = await adminRequest('/admin/uploads/images', {
          method: 'POST',
          body: file,
        });
        uploaded.push({
          url: localImageUrl(response.data.url),
          alt: form.name,
        });
      }
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded] }));
    } catch (requestError) {
      setError(requestError.message || 'The image storage service did not confirm the upload.');
    } finally {
      setUploading(false);
    }
  }

  function validateForm() {
    if (!form.name.trim() || !form.slug.trim() || !form.description.trim()) {
      return 'Product name, slug, and description are required.';
    }
    if (!form.categoryId) return 'Choose a category.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      return 'Use a lowercase, hyphen-separated URL slug.';
    }
    if (!form.variants.length && !/^[a-zA-Z0-9._-]{1,64}$/.test(form.sku.trim())) {
      return 'Enter a SKU using letters, numbers, dots, dashes, or underscores.';
    }
    if (form.images.length > 10) return 'A product can have up to 10 images.';
    for (const [label, value] of [
      ['Original price', form.originalPrice],
      ['Selling price', form.sellingPrice],
    ]) {
      if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
        return `${label} must be a non-negative number.`;
      }
      if (Math.round(Number(value) * 100) !== Number(value) * 100) {
        return `${label} can have at most two decimal places.`;
      }
    }
    if (Number(form.sellingPrice) > Number(form.originalPrice)) {
      return 'Selling price cannot exceed original price.';
    }
    if (!form.variants.length && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0)) {
      return 'Stock quantity must be a non-negative whole number.';
    }
    for (const [index, variant] of form.variants.entries()) {
      if (
        !/^[a-zA-Z0-9._-]{1,64}$/.test(variant.sku.trim()) ||
        !Object.keys(variantAttributes(variant)).length
      ) {
        return `Variant ${index + 1} needs a SKU and at least one attribute.`;
      }
      if (Number(variant.sellingPrice) > Number(variant.originalPrice)) {
        return `Variant ${index + 1} selling price cannot exceed original price.`;
      }
      for (const field of ['originalPrice', 'sellingPrice', 'stock', 'lowStockThreshold']) {
        if (variant[field] === '' || !Number.isFinite(Number(variant[field])) || Number(variant[field]) < 0) {
          return `Variant ${index + 1} has an invalid ${field}.`;
        }
      }
      for (const field of ['originalPrice', 'sellingPrice']) {
        if (Math.round(Number(variant[field]) * 100) !== Number(variant[field]) * 100) {
          return `Variant ${index + 1} prices can have at most two decimal places.`;
        }
      }
      if (!Number.isInteger(Number(variant.stock)) || !Number.isInteger(Number(variant.lowStockThreshold))) {
        return `Variant ${index + 1} stock and threshold must be whole numbers.`;
      }
    }
    return '';
  }

  async function adjustStock(product, variant, nextStock) {
    const previousStock = Number(variant?.stock ?? product.stock ?? 0);
    const delta = nextStock - previousStock;
    if (!delta) return;
    await adminRequest('/admin/inventory/adjustments', {
      method: 'POST',
      body: {
        productId: product._id,
        ...(variant?._id ? { variantId: variant._id } : {}),
        delta,
        reason: 'Stock quantity updated in admin product form',
      },
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || uploading) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const variants = form.variants.map(toVariantPayload);
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        sku: variants.length ? null : form.sku.trim(),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null,
        images: parseImages(form.images),
        originalPrice: Number(form.originalPrice),
        sellingPrice: Number(form.sellingPrice),
        status: form.status,
        featured: form.featured,
        bestseller: form.bestseller,
      };

      if (!isEditing) {
        const created = await adminRequest('/admin/products', {
          method: 'POST',
          body: {
            ...payload,
            ...(variants.length
              ? { stock: 0, variants }
              : {
                  stock: Number(form.stock),
                  lowStockThreshold: Number(form.lowStockThreshold),
                }),
          },
        });
        navigate('/admin/products', {
          replace: true,
          state: { notice: `${created.data.product.name} was created.` },
        });
        return;
      }

      const hasNewVariants = form.variants.some((variant) => !variant.id);
      if (!originalProduct.variants?.length && hasNewVariants) {
        await adjustStock(originalProduct, null, 0);
      }
      const originalVariants = originalProduct.variants ?? [];
      if (originalVariants.length && !form.variants.length) {
        for (const oldVariant of originalVariants) {
          await adminRequest(
            `/admin/products/${productId}/variants/${oldVariant._id}`,
            { method: 'DELETE' },
          );
        }
      }
      const updatedResponse = await adminRequest(`/admin/products/${productId}`, {
        method: 'PATCH',
        body: payload,
      });
      const updatedProduct = updatedResponse.data.product;
      const retainedIds = new Set(
        form.variants.filter((variant) => variant.id).map((variant) => variant.id),
      );

      if (form.variants.length) {
        for (const oldVariant of originalVariants) {
          if (!retainedIds.has(String(oldVariant._id))) {
            await adminRequest(
              `/admin/products/${productId}/variants/${oldVariant._id}`,
              { method: 'DELETE' },
            );
          }
        }
      }

      for (const variant of form.variants) {
        const variantPayload = toVariantPayload(variant);
        if (!variant.id) {
          await adminRequest(
            `/admin/products/${productId}/variants`,
            { method: 'POST', body: variantPayload },
          );
          continue;
        }
        const oldVariant = originalVariants.find(
          (item) => String(item._id) === variant.id,
        );
        await adminRequest(
          `/admin/products/${productId}/variants/${variant.id}`,
          {
            method: 'PATCH',
            body: {
              sku: variantPayload.sku,
              attributes: variantPayload.attributes,
              originalPrice: variantPayload.originalPrice,
              sellingPrice: variantPayload.sellingPrice,
              lowStockThreshold: variantPayload.lowStockThreshold,
              images: variantPayload.images,
            },
          },
        );
        await adjustStock(updatedProduct, oldVariant, Number(variant.stock));
      }

      if (!form.variants.length) {
        await adjustStock(updatedProduct, null, Number(form.stock));
      }

      navigate('/admin/products', {
        replace: true,
        state: { notice: `${updatedProduct.name} was updated.` },
      });
    } catch (requestError) {
      setError(requestError.message || 'Could not save this product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admin-loading-screen"><LoaderCircle className="admin-spin" size={22} /> Loading product…</div>;
  }

  const activeCategory = categories.find((item) => categoryId(item) === form.categoryId);

  return (
    <div className="admin-page">
      <div className="admin-page-heading admin-form-page-heading">
        <div>
          <Link className="admin-back-link" to="/admin/products"><ArrowLeft size={15} /> Products</Link>
          <span className="eyebrow">{isEditing ? 'UPDATE YOUR CATALOG' : 'GROW YOUR CATALOG'}</span>
          <h1>{isEditing ? 'Edit product' : 'Add a product'}</h1>
          <p>{isEditing ? 'Keep product details and inventory up to date.' : 'Add the details customers need to find their next favourite.'}</p>
        </div>
        <span className={`admin-status-pill status-${form.status}`}>{form.status}</span>
      </div>

      {error && <div className="admin-alert admin-alert-error" role="alert"><X size={17} /><span>{error}</span></div>}

      {!categories.length ? (
        <div className="admin-panel admin-empty-state">
          <strong>Create a category first</strong>
          <span>Products need a category before they can be added to the catalog.</span>
          <Link className="admin-button admin-button-primary" to="/admin/categories"><Plus size={16} /> Create category</Link>
        </div>
      ) : (
        <form className="admin-product-form" onSubmit={submit}>
          <div className="admin-product-form-main">
            <section className="admin-panel admin-form-section">
              <div className="admin-form-section-heading">
                <span className="admin-form-step">01</span>
                <div><h2>Product details</h2><p>Set the name and description customers will see.</p></div>
              </div>
              <div className="admin-form-grid">
                <label className="admin-field admin-field-full">
                  <span>Product name <i>*</i></span>
                  <input name="name" value={form.name} onChange={updateField} maxLength={200} required />
                </label>
                <label className="admin-field admin-field-full">
                  <span>Product URL slug <i>*</i></span>
                  <input name="slug" value={form.slug} onChange={(event) => {
                    setSlugTouched(true);
                    updateField(event);
                  }} maxLength={180} required />
                  <small>Lowercase letters, numbers and hyphens.</small>
                </label>
                <label className="admin-field admin-field-full">
                  <span>Description <i>*</i></span>
                  <textarea name="description" rows={5} value={form.description} onChange={updateField} maxLength={20000} required />
                </label>
              </div>
            </section>

            <section className="admin-panel admin-form-section">
              <div className="admin-form-section-heading">
                <span className="admin-form-step">02</span>
                <div><h2>Images</h2><p>Choose image files from your device. PNG, JPEG, or WebP; up to 5 MB each.</p></div>
              </div>
              <div className="admin-image-uploader">
                <label className={`admin-upload-drop${uploading ? ' is-uploading' : ''}`}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={uploadFiles} disabled={uploading || form.images.length >= 10} />
                  <span className="admin-upload-icon">{uploading ? <LoaderCircle className="admin-spin" size={22} /> : <UploadCloud size={22} />}</span>
                  <strong>{uploading ? 'Uploading images…' : 'Choose image files'}</strong>
                  <small>PNG, JPEG or WebP · up to 5 MB each · max 10</small>
                </label>
              </div>
              {form.images.length > 0 && (
                <div className="admin-image-grid">
                  {form.images.map((image, index) => (
                    <article className="admin-image-card" key={`${image.url}-${index}`}>
                      <img src={localImageUrl(image.url)} alt={image.alt || ''} />
                      <label className="admin-image-alt">
                        <span className="sr-only">Image {index + 1} alt text</span>
                        <input value={image.alt ?? ''} maxLength={200} placeholder="Image description" onChange={(event) => updateImage(index, 'alt', event.target.value)} />
                      </label>
                      <button type="button" className="admin-image-remove" onClick={() => setForm((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remove image ${index + 1}`}><Trash2 size={15} /></button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-panel admin-form-section">
              <div className="admin-form-section-heading">
                <span className="admin-form-step">03</span>
                <div><h2>Pricing & inventory</h2><p>Set regular pricing and manage product stock.</p></div>
              </div>
              <div className="admin-form-grid admin-form-grid-three">
                <label className="admin-field">
                  <span>Original price (₹) <i>*</i></span>
                  <input name="originalPrice" type="number" min="0" step="0.01" value={form.originalPrice} onChange={updateField} required />
                </label>
                <label className="admin-field">
                  <span>Selling price (₹) <i>*</i></span>
                  <input name="sellingPrice" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={updateField} required />
                </label>
                {form.variants.length === 0 && (
                  <>
                    <label className="admin-field">
                      <span>SKU <i>*</i></span>
                      <input name="sku" value={form.sku} onChange={updateField} maxLength={64} required />
                    </label>
                    <label className="admin-field">
                      <span>Stock quantity</span>
                      <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={updateField} />
                    </label>
                    <label className="admin-field">
                      <span>Low-stock threshold</span>
                      <input name="lowStockThreshold" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={updateField} />
                    </label>
                  </>
                )}
              </div>
            </section>

            <section className="admin-panel admin-form-section">
              <div className="admin-form-section-heading">
                <span className="admin-form-step">04</span>
                <div><h2>Product variants</h2><p>Optional size, colour, weight or other options with separate stock and SKU.</p></div>
                <button className="admin-button admin-button-quiet admin-section-action" type="button" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }))}><Plus size={15} /> Add variant</button>
              </div>
              {form.variants.length === 0 ? (
                <div className="admin-variants-empty"><ImagePlus size={18} /><span>No variants added. Add one for size, colour or other options.</span></div>
              ) : (
                <div className="admin-variant-list">
                  {form.variants.map((variant, index) => (
                    <article className="admin-variant-card" key={variant.id || `new-${index}`}>
                      <div className="admin-variant-heading">
                        <strong>Variant {index + 1}</strong>
                        {variant.id && <small>Existing variant</small>}
                        <button className="admin-icon-button admin-icon-danger" type="button" onClick={() => {
                          if (variant.id && Number(variant.stock) > 0) {
                            setError('Set a variant stock quantity to zero before removing it.');
                            return;
                          }
                          setForm((current) => ({ ...current, variants: current.variants.filter((_, itemIndex) => itemIndex !== index) }));
                          setError('');
                        }} aria-label={`Remove variant ${index + 1}`}><Trash2 size={15} /></button>
                      </div>
                      <div className="admin-form-grid admin-form-grid-three">
                        <label className="admin-field"><span>Variant SKU <i>*</i></span><input value={variant.sku} onChange={(event) => updateVariant(index, 'sku', event.target.value)} maxLength={64} /></label>
                        <label className="admin-field"><span>Size</span><input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} maxLength={100} /></label>
                        <label className="admin-field"><span>Color</span><input value={variant.color} onChange={(event) => updateVariant(index, 'color', event.target.value)} maxLength={100} /></label>
                        <label className="admin-field"><span>Weight</span><input value={variant.weight} onChange={(event) => updateVariant(index, 'weight', event.target.value)} maxLength={100} /></label>
                        <label className="admin-field admin-field-wide"><span>Other attributes <small>(one per line: Material=Cotton)</small></span><textarea rows={2} value={variant.other} onChange={(event) => updateVariant(index, 'other', event.target.value)} /></label>
                        <label className="admin-field"><span>Original price (₹)</span><input type="number" min="0" step="0.01" value={variant.originalPrice} onChange={(event) => updateVariant(index, 'originalPrice', event.target.value)} /></label>
                        <label className="admin-field"><span>Selling price (₹)</span><input type="number" min="0" step="0.01" value={variant.sellingPrice} onChange={(event) => updateVariant(index, 'sellingPrice', event.target.value)} /></label>
                        <label className="admin-field"><span>Stock quantity</span><input type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', event.target.value)} /></label>
                        <label className="admin-field"><span>Low-stock threshold</span><input type="number" min="0" step="1" value={variant.lowStockThreshold} onChange={(event) => updateVariant(index, 'lowStockThreshold', event.target.value)} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="admin-product-form-aside">
            <section className="admin-panel admin-form-section">
              <div className="admin-form-section-heading"><div><h2>Organization</h2><p>Choose where shoppers will find this product.</p></div></div>
              <div className="admin-form-stack">
                <label className="admin-field">
                  <span>Category <i>*</i></span>
                  <select name="categoryId" value={form.categoryId} onChange={updateField} required>
                    <option value="">Select category</option>
                    {topLevelCategories.map((category) => <option value={categoryId(category)} key={categoryId(category)}>{categoryName(category)}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Subcategory</span>
                  <select name="subcategoryId" value={form.subcategoryId} onChange={updateField} disabled={!subcategories.length}>
                    <option value="">No subcategory</option>
                    {subcategories.map((category) => <option value={categoryId(category)} key={categoryId(category)}>{categoryName(category)}</option>)}
                  </select>
                  {activeCategory && !subcategories.length && <small>This category has no subcategories.</small>}
                </label>
                <label className="admin-field">
                  <span>Product status</span>
                  <select name="status" value={form.status} onChange={updateField}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </section>
            <section className="admin-panel admin-form-section admin-form-options">
              <h2>Store visibility</h2>
              <label className="admin-switch-row">
                <span><strong>Featured product</strong><small>Highlight this item in the store.</small></span>
                <input type="checkbox" name="featured" checked={form.featured} onChange={updateField} />
                <i aria-hidden="true" />
              </label>
              <label className="admin-switch-row">
                <span><strong>Bestseller</strong><small>Mark in the bestseller collection.</small></span>
                <input type="checkbox" name="bestseller" checked={form.bestseller} onChange={updateField} />
                <i aria-hidden="true" />
              </label>
            </section>
            <div className="admin-form-submit-panel">
              <p>{form.status === 'active' ? 'Active products are eligible to appear in the storefront.' : 'Draft and inactive products are hidden from the storefront.'}</p>
              <button className="admin-button admin-button-primary admin-button-full" type="submit" disabled={saving || uploading || !categories.length}>
                {saving ? <LoaderCircle className="admin-spin" size={16} /> : <Check size={16} />}
                {saving ? 'Saving product…' : isEditing ? 'Save changes' : 'Create product'}
              </button>
              <Link className="admin-cancel-link" to="/admin/products">Cancel</Link>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
