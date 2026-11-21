import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  Layers3,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  Tags,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchAllProducts, localImageUrl, productStockState } from '../../admin/admin-utils.js';

const initialStats = {
  products: 0,
  categories: 0,
  active: 0,
  draft: 0,
  low: 0,
  out: 0,
  recent: [],
};

function MetricCard({ title, value, note, icon: Icon, tone }) {
  return (
    <article className={`admin-metric-card admin-metric-${tone}`}>
      <div className="admin-metric-top">
        <span className="admin-metric-icon"><Icon size={19} /></span>
        <span className="admin-metric-note">{note}</span>
      </div>
      <strong className="admin-metric-value">{value}</strong>
      <span className="admin-metric-label">{title}</span>
    </article>
  );
}

function stockLabel(product) {
  const variants = product.variants ?? [];
  if (variants.length) {
    const count = variants.reduce((sum, item) => sum + item.stock, 0);
    return `${count} across ${variants.length} variant${variants.length === 1 ? '' : 's'}`;
  }
  return `${product.stock ?? 0} in stock`;
}

export default function AdminDashboardPage() {
  const { adminRequest } = useAuth();
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      fetchAllProducts(adminRequest),
      adminRequest('/admin/categories?page=1&limit=1'),
    ])
      .then(([products, categoriesResponse]) => {
        if (!active) return;
        const sortedRecent = [...products]
          .sort(
            (first, second) =>
              new Date(second.updatedAt ?? second.createdAt) -
              new Date(first.updatedAt ?? first.createdAt),
          )
          .slice(0, 6);
        setStats({
          products: products.length,
          categories: categoriesResponse.data.pagination.total,
          active: products.filter((product) => product.status === 'active').length,
          draft: products.filter((product) => product.status === 'draft').length,
          low: products.filter((product) => productStockState(product) === 'low').length,
          out: products.filter((product) => productStockState(product) === 'out').length,
          recent: sortedRecent,
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load store data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [adminRequest, reload]);

  return (
    <div className="admin-page">
      <div className="admin-page-heading admin-dashboard-heading">
        <div>
          <span className="eyebrow">YOUR STORE AT A GLANCE</span>
          <h1>Good morning<span className="admin-heading-spark"> ✳</span></h1>
          <p>Here’s what’s happening with your products today.</p>
        </div>
        <div className="admin-heading-actions">
          <button
            className="admin-button admin-button-quiet"
            type="button"
            onClick={() => setReload((count) => count + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'admin-spin' : ''} />
            Refresh
          </button>
          <Link className="admin-button admin-button-primary" to="/admin/products/new">
            <Package size={16} /> Add product
          </Link>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setReload((count) => count + 1)}>Try again</button>
        </div>
      )}

      <section className="admin-metric-grid" aria-label="Store metrics">
        <MetricCard title="Total products" value={loading ? '—' : stats.products} note="Across all statuses" icon={Package} tone="aqua" />
        <MetricCard title="Categories" value={loading ? '—' : stats.categories} note="Store collections" icon={Tags} tone="copper" />
        <MetricCard title="Active products" value={loading ? '—' : stats.active} note="Visible in storefront" icon={PackageCheck} tone="green" />
        <MetricCard title="Draft products" value={loading ? '—' : stats.draft} note="Not published" icon={Layers3} tone="dark" />
        <MetricCard title="Low stock" value={loading ? '—' : stats.low} note="At or below threshold" icon={ArrowDownRight} tone="amber" />
        <MetricCard title="Out of stock" value={loading ? '—' : stats.out} note="Needs replenishment" icon={PackageX} tone="rose" />
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">LATEST CHANGES</span>
              <h2>Recent product updates</h2>
            </div>
            <Link to="/admin/products" className="admin-text-link">All products <ArrowUpRight size={15} /></Link>
          </div>
          {loading ? (
            <div className="admin-empty-state">Loading your product updates…</div>
          ) : stats.recent.length ? (
            <div className="admin-recent-list">
              {stats.recent.map((product) => (
                <Link
                  className="admin-recent-item"
                  key={product._id}
                  to={`/admin/products/${product._id}/edit`}
                >
                  <span className="admin-recent-image">
                    {product.images?.[0]?.url ? (
                      <img src={localImageUrl(product.images[0].url)} alt="" />
                    ) : (
                      <Package size={18} />
                    )}
                  </span>
                  <span className="admin-recent-copy">
                    <strong>{product.name}</strong>
                    <small>{product.sku || `${product.variants?.length ?? 0} variants`} · {stockLabel(product)}</small>
                  </span>
                  <span className={`admin-status-pill status-${product.status}`}>{product.status}</span>
                  <span className="admin-recent-date">
                    {new Date(product.updatedAt ?? product.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="admin-empty-state">
              <Package size={26} />
              <strong>No products yet</strong>
              <span>Add your first product to start building the catalog.</span>
              <Link to="/admin/products/new" className="admin-text-link">Create a product <ArrowUpRight size={15} /></Link>
            </div>
          )}
        </article>

        <aside className="admin-panel admin-stock-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">INVENTORY HEALTH</span>
              <h2>Stock overview</h2>
            </div>
          </div>
          <div className="admin-stock-summary">
            <div className="admin-stock-summary-row">
              <span className="stock-indicator stock-indicator-good" />
              <span>Well stocked</span>
              <strong>{loading ? '—' : Math.max(stats.products - stats.low - stats.out, 0)}</strong>
            </div>
            <div className="admin-stock-summary-row">
              <span className="stock-indicator stock-indicator-low" />
              <span>Running low</span>
              <strong>{loading ? '—' : stats.low}</strong>
            </div>
            <div className="admin-stock-summary-row">
              <span className="stock-indicator stock-indicator-out" />
              <span>Out of stock</span>
              <strong>{loading ? '—' : stats.out}</strong>
            </div>
          </div>
          <div className="admin-stock-callout">
            <span className="admin-stock-callout-icon"><CircleAlert size={18} /></span>
            <span><strong>Keep the shelves ready</strong><small>Review low stock and update quantities.</small></span>
          </div>
          <Link to="/admin/products" className="admin-stock-link">Review inventory <ArrowUpRight size={15} /></Link>
        </aside>
      </section>
    </div>
  );
}
