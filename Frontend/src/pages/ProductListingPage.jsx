import { useEffect, useMemo, useState } from 'react';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/Feedback.jsx';
import Pagination from '../components/Pagination.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { useCatalog } from '../hooks/use-catalog.js';
import { queryString } from '../lib/api.js';

const PAGE_LIMIT = 12;

function normalizeOptionalPrice(value) {
  if (!value) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : '';
}

export default function ProductListingPage({
  searchMode = false,
  categorySlug = '',
  categoryName = '',
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchMode ? searchParams.get('q') || '' : searchParams.get('q') || '';
  const category = categorySlug || searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const minPriceParam = normalizeOptionalPrice(searchParams.get('minPrice'));
  const maxPriceParam = normalizeOptionalPrice(searchParams.get('maxPrice'));
  const featured = searchParams.get('featured') || '';
  const bestseller = searchParams.get('bestseller') || '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState({
    category,
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
  });

  useEffect(() => {
    setDraft({ category, minPrice: minPriceParam, maxPrice: maxPriceParam });
  }, [category, minPriceParam, maxPriceParam]);

  const categories = useCatalog(`/categories${queryString({ limit: 100 })}`);
  const filters = useMemo(
    () => ({
      q: q || undefined,
      category: category || undefined,
      minPrice: minPriceParam || undefined,
      maxPrice: maxPriceParam || undefined,
      sort,
      featured: featured || undefined,
      bestseller: bestseller || undefined,
      page,
      limit: PAGE_LIMIT,
    }),
    [bestseller, category, featured, maxPriceParam, minPriceParam, page, q, sort],
  );
  const path = `/products${queryString(filters)}`;
  const { data, loading, error } = useCatalog(path);

  const title = categoryName
    ? categoryName
    : searchMode
    ? `Results for “${q}”`
    : featured === 'true'
      ? 'Featured finds'
      : bestseller === 'true'
        ? 'Bestsellers'
        : category
          ? 'Explore the collection'
          : 'All the good finds';
  const heading = searchMode ? 'SEARCH RESULTS' : 'THE COLLECTION';

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    for (const key of ['category', 'minPrice', 'maxPrice']) next.delete(key);
    if (!categorySlug && draft.category) next.set('category', draft.category);
    if (draft.minPrice) next.set('minPrice', draft.minPrice);
    if (draft.maxPrice) next.set('maxPrice', draft.maxPrice);
    next.delete('page');
    navigate(`${location.pathname}?${next.toString()}`);
    setFiltersOpen(false);
  }

  function setSort(value) {
    const next = new URLSearchParams(searchParams);
    next.set('sort', value);
    next.delete('page');
    navigate(`${location.pathname}?${next.toString()}`);
  }

  function setPage(value) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(value));
    navigate(`${location.pathname}?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (featured) next.set('featured', featured);
    if (bestseller) next.set('bestseller', bestseller);
    navigate(`${location.pathname}${next.size ? `?${next}` : ''}`);
  }

  return (
    <div className="page-shell inner-page listing-page">
      <div className="breadcrumb"><span>{searchMode ? 'Search' : 'Shop'}</span><span>/</span><strong>{title}</strong></div>
      <div className="listing-heading">
        <div className="page-intro page-intro-compact">
          <span className="eyebrow">{heading}</span>
          <h1>{title}</h1>
          <p>
            {loading
              ? 'Finding just the right things...'
              : `${data?.pagination?.total ?? 0} ${data?.pagination?.total === 1 ? 'piece' : 'pieces'} to explore`}
          </p>
        </div>
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className="listing-toolbar">
        <button
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal size={17} /> Filters <Filter size={15} />
        </button>
        <span>{data?.pagination?.total ?? 0} products</span>
        {(category || minPriceParam || maxPriceParam) && (
          <button className="text-button clear-filter" type="button" onClick={clearFilters}>
            Clear filters <X size={14} />
          </button>
        )}
      </div>

      <div className={`listing-layout${filtersOpen ? ' filters-visible' : ''}`}>
        <aside className="filter-panel" aria-label="Product filters">
          <div className="filter-panel-heading">
            <h2>Refine your view</h2>
            <button type="button" className="icon-button filter-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={applyFilters}>
            {!categorySlug && (
              <>
                <label className="field-label" htmlFor="category-filter">Category</label>
                <select
                  id="category-filter"
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                >
                  <option value="">All categories</option>
                  {(categories.data?.categories || []).map((item) => (
                    <option key={item._id || item.slug} value={item.slug}>{item.name}</option>
                  ))}
                </select>
                {categories.error && <small className="field-hint">Category choices couldn’t be loaded.</small>}
              </>
            )}
            <span className="field-label price-label">Price range (₹)</span>
            <div className="price-inputs">
              <label>
                <span className="sr-only">Minimum price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={draft.minPrice}
                  onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value }))}
                />
              </label>
              <span aria-hidden="true">—</span>
              <label>
                <span className="sr-only">Maximum price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max"
                  value={draft.maxPrice}
                  onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value }))}
                />
              </label>
            </div>
            {draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice) && (
              <small className="field-error">Maximum price should be at least the minimum.</small>
            )}
            <button
              className="button button-dark filter-apply"
              type="submit"
              disabled={Boolean(draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice))}
            >
              Apply filters
            </button>
          </form>
        </aside>

        <div className="listing-results">
          {error ? (
            <ErrorState error={error} onRetry={() => navigate(0)} />
          ) : loading ? (
            <LoadingState label="Loading products" />
          ) : (
            <>
              <ProductGrid
                products={data?.products || []}
                emptyTitle={searchMode ? 'No matching products yet' : 'No products match these filters'}
                emptyDescription={searchMode ? 'Try another search, or explore all products.' : 'Try a different category or price range.'}
              />
              <Pagination
                page={data?.pagination?.page || page}
                pages={data?.pagination?.pages || 0}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
