import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  FolderTree,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { localImageUrl, slugify } from '../../admin/admin-utils.js';

const pageSize = 20;
const blankCategory = {
  name: '',
  slug: '',
  description: '',
  image: '',
  parentId: '',
  status: 'active',
};

function categoryId(category) {
  return String(category._id ?? category.id);
}

export default function AdminCategoriesPage() {
  const { adminRequest } = useAuth();
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankCategory);
  const [editingId, setEditingId] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);
      const response = await adminRequest(`/admin/categories?${params}`);
      setCategories(response.data.categories);
      setPagination(response.data.pagination);
    } catch (requestError) {
      setError(requestError.message || 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, [adminRequest, page, statusFilter]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories, reload]);

  const matchedCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter(
      (category) =>
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query),
    );
  }, [categories, search]);

  const parentNames = useMemo(() => {
    const parents = new Map(categories.map((category) => [categoryId(category), category.name]));
    return parents;
  }, [categories]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'name' && !slugTouched ? { slug: slugify(value) } : {}),
    }));
  }

  function resetForm() {
    if (uploadingImage) return;
    setForm(blankCategory);
    setEditingId('');
    setSlugTouched(false);
    setError('');
    setSuccess('');
  }

  function editCategory(category) {
    if (uploadingImage) return;
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      image: category.image ?? '',
      parentId: category.parentId ? String(category.parentId) : '',
      status: category.status,
    });
    setEditingId(categoryId(category));
    setSlugTouched(true);
    setError('');
    setSuccess('');
  }

  async function uploadCategoryImage(event) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG, or WebP image no larger than 5 MB.');
      return;
    }

    setUploadingImage(true);
    setError('');
    setSuccess('');
    try {
      const response = await adminRequest('/admin/uploads/images', {
        method: 'POST',
        body: file,
      });
      setForm((current) => ({
        ...current,
        image: localImageUrl(response.data.url),
      }));
    } catch (requestError) {
      setError(requestError.message || 'Could not upload this image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || uploadingImage) return;
    setError('');
    setSuccess('');
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Category name and slug are required.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      setError('Use a lowercase, hyphen-separated URL slug.');
      return;
    }
    if (form.image.trim()) {
      try {
        const image = new URL(form.image.trim());
        if (!['http:', 'https:'].includes(image.protocol)) throw new Error();
      } catch {
        setError('Enter a valid HTTP or HTTPS image URL.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        parentId: form.parentId || null,
        status: form.status,
      };
      const response = editingId
        ? await adminRequest(`/admin/categories/${editingId}`, {
            method: 'PATCH',
            body: payload,
          })
        : await adminRequest('/admin/categories', {
            method: 'POST',
            body: payload,
          });
      setSuccess(response.message || 'Category saved.');
      resetForm();
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(requestError.message || 'Could not save this category.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete “${category.name}”? Categories with products or subcategories cannot be deleted.`)) return;
    setError('');
    setSuccess('');
    try {
      const response = await adminRequest(`/admin/categories/${categoryId(category)}`, {
        method: 'DELETE',
      });
      setSuccess(response.message || 'Category deleted.');
      if (editingId === categoryId(category)) resetForm();
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this category.');
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">ORGANIZE YOUR STORE</span>
          <h1>Categories</h1>
          <p>Group products into collections shoppers can browse.</p>
        </div>
        <span className="admin-total-chip"><Tags size={15} /> {pagination.total} categories</span>
      </div>

      {error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => setReload((count) => count + 1)}>Dismiss / retry</button></div>}
      {success && <div className="admin-alert admin-alert-success" role="status"><Check size={18} /><span>{success}</span><button type="button" onClick={() => setSuccess('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <div className="admin-category-layout">
        <section className="admin-panel admin-table-panel">
          <div className="admin-toolbar">
            <label className="admin-search-form">
              <Search size={17} />
              <input aria-label="Search categories" placeholder="Find a category…" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}
            </label>
            <label className="admin-filter-control">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="admin-category-list">
            {loading ? (
              <div className="admin-table-message"><LoaderCircle className="admin-spin" size={18} /> Loading categories…</div>
            ) : matchedCategories.length ? matchedCategories.map((category) => (
              <article className="admin-category-row" key={categoryId(category)}>
                <span className="admin-category-image">
                  {category.image ? <img src={localImageUrl(category.image)} alt="" /> : <ImageIcon size={18} />}
                </span>
                <span className="admin-category-copy">
                  <strong>{category.name}</strong>
                  <small>{category.parentId ? <><FolderTree size={12} /> {parentNames.get(String(category.parentId)) ?? 'Subcategory'}</> : `/${category.slug}`}</small>
                </span>
                <span className={`admin-status-pill status-${category.status}`}>{category.status}</span>
                <div className="admin-row-actions">
                  <button className="admin-icon-button" type="button" onClick={() => editCategory(category)} aria-label={`Edit ${category.name}`} title="Edit category"><Edit3 size={15} /></button>
                  <button className="admin-icon-button admin-icon-danger" type="button" onClick={() => deleteCategory(category)} aria-label={`Delete ${category.name}`} title="Delete category"><Trash2 size={15} /></button>
                </div>
              </article>
            )) : (
              <div className="admin-empty-state">
                <span className="admin-empty-icon"><Tags size={20} /></span>
                <strong>No categories found</strong>
                <span>Try another search or add your first category.</span>
              </div>
            )}
          </div>
          <div className="admin-pagination">
            <span>{loading ? 'Loading…' : `${matchedCategories.length} shown · ${pagination.total} total`}</span>
            <div className="admin-pagination-actions">
              <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
              <span>Page {pagination.page || page} of {Math.max(pagination.pages, 1)}</span>
              <button type="button" disabled={loading || page >= pagination.pages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
            </div>
          </div>
        </section>

        <aside className="admin-panel admin-category-editor">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">{editingId ? 'UPDATE COLLECTION' : 'NEW COLLECTION'}</span>
              <h2>{editingId ? 'Edit category' : 'Add category'}</h2>
            </div>
            {editingId && <button className="admin-icon-button" type="button" onClick={resetForm} aria-label="Cancel editing"><RotateCcw size={16} /></button>}
          </div>
          <form className="admin-form" onSubmit={submit}>
            <label className="admin-field">
              <span>Category name <i>*</i></span>
              <input name="name" value={form.name} onChange={updateField} maxLength={120} required />
            </label>
            <label className="admin-field">
              <span>Slug <i>*</i></span>
              <input name="slug" value={form.slug} onChange={(event) => {
                setSlugTouched(true);
                updateField(event);
              }} maxLength={140} required />
            </label>
            <label className="admin-field">
              <span>Description</span>
              <textarea name="description" rows={3} value={form.description} onChange={updateField} maxLength={2000} />
            </label>
            <label className={`admin-upload-drop${uploadingImage ? ' is-uploading' : ''}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadCategoryImage}
                disabled={uploadingImage || saving}
              />
              <span className="admin-upload-icon">
                {uploadingImage
                  ? <LoaderCircle className="admin-spin" size={22} />
                  : <UploadCloud size={22} />}
              </span>
              <strong>{uploadingImage ? 'Uploading image…' : form.image ? 'Choose a different image' : 'Upload category image'}</strong>
              <small>PNG, JPEG or WebP · up to 5 MB</small>
            </label>
            {form.image && (
              <div className="admin-category-image-preview">
                <img src={localImageUrl(form.image)} alt="Category preview" />
                <button
                  className="admin-image-remove"
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, image: '' }))}
                  disabled={uploadingImage || saving}
                  aria-label="Remove category image"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <label className="admin-field">
              <span>Parent category</span>
              <select name="parentId" value={form.parentId} onChange={updateField}>
                <option value="">No parent (top-level)</option>
                {categories
                  .filter(
                    (category) =>
                      !category.parentId && categoryId(category) !== editingId,
                  )
                  .map((category) => (
                    <option key={categoryId(category)} value={categoryId(category)}>{category.name}</option>
                  ))}
              </select>
              <small>Subcategories can only be one level deep.</small>
            </label>
            <label className="admin-field">
              <span>Status</span>
              <select name="status" value={form.status} onChange={updateField}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <button className="admin-button admin-button-primary admin-button-full" type="submit" disabled={saving || uploadingImage}>
              {saving || uploadingImage ? <LoaderCircle className="admin-spin" size={16} /> : <Check size={16} />}
              {uploadingImage ? 'Uploading image…' : saving ? 'Saving category…' : editingId ? 'Save category' : 'Create category'}
            </button>
            {editingId && <button className="admin-cancel-link" type="button" onClick={resetForm} disabled={uploadingImage}>Cancel editing</button>}
          </form>
        </aside>
      </div>
    </div>
  );
}
