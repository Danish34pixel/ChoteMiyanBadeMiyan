import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CategoryTile from '../components/CategoryTile.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { useCatalog } from '../hooks/use-catalog.js';
import { queryString } from '../lib/api.js';

const categoryPath = `/categories${queryString({ limit: 100 })}`;
const featuredPath = `/products${queryString({ featured: true, limit: 4, sort: 'newest' })}`;
const latestPath = `/products${queryString({ limit: 4, sort: 'newest' })}`;

function ProductSection({ title, eyebrow, to, result, error, loading }) {
  return (
    <section className="page-shell home-section">
      <SectionHeading eyebrow={eyebrow} title={title} action="View all" to={to} />
      {loading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}`} />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <ProductGrid products={result?.products || []} />
      )}
    </section>
  );
}

export default function HomePage() {
  const categories = useCatalog(categoryPath);
  const featured = useCatalog(featuredPath);
  const latest = useCatalog(latestPath);

  return (
    <>
      <section className="brand-hero">
        <div className="brand-hero-grain" aria-hidden="true" />
        <span className="brand-hero-orbit brand-hero-orbit-one" aria-hidden="true" />
        <span className="brand-hero-orbit brand-hero-orbit-two" aria-hidden="true" />
        <div className="page-shell hero-content">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="hero-kicker"><Sparkles size={14} /> छोटे मियां बड़े मियां <i>·</i> THE GOOD FINDS STORE</span>
            <h1>Everyday finds.<br /><span>A little extra magic.</span></h1>
            <p>A growing collection for curious minds and everyday moments. Come in, take a look around.</p>
            <div className="hero-actions">
              <Link className="button button-copper" to="/products">
                Shop the collection <ArrowUpRight size={17} />
              </Link>
              <Link className="hero-text-link" to="/categories">
                Browse categories <ArrowDownRight size={16} />
              </Link>
            </div>
            <div className="hero-trust-note"><span /> A little something for everyone</div>
          </motion.div>
          <div className="hero-logo-stage">
            <div className="hero-logo-frame">
              <img
                src="/brand-logo.png"
                alt="छोटे मियां बड़े मियां — Chote Miyan Bade Miya"
                width="663"
                height="875"
                fetchPriority="high"
              />
            </div>
            <span className="hero-logo-caption">दो मियां, ढेर सारी खुशियां <i>·</i> Two Miyan, endless finds</span>
            <span className="hero-logo-star hero-logo-star-one" aria-hidden="true">✳</span>
            <span className="hero-logo-star hero-logo-star-two" aria-hidden="true">✦</span>
          </div>
          <div className="hero-index"><span>01</span> <i>/</i> DISCOVER</div>
        </div>
        <div className="hero-bottom-line"><span /></div>
      </section>

      <section className="page-shell home-section category-section">
        <SectionHeading eyebrow="FIND YOUR CORNER" title="Shop by category" action="All categories" to="/categories" />
        {categories.loading ? (
          <LoadingState label="Finding categories" />
        ) : categories.error ? (
          <ErrorState error={categories.error} />
        ) : categories.data?.categories?.length ? (
          <div className="category-grid">
            {categories.data.categories.slice(0, 8).map((category, index) => (
              <CategoryTile key={category._id || category.slug} category={category} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState title="Categories are on their way" description="Check back when the collection is ready." />
        )}
      </section>

      <ProductSection
        eyebrow="HANDPICKED FOR YOU"
        title="Featured finds"
        to="/products?featured=true"
        result={featured.data}
        error={featured.error}
        loading={featured.loading}
      />

      <section className="deal-placeholder">
        <div className="page-shell deal-placeholder-inner">
          <div className="deal-sunburst" aria-hidden="true">✳</div>
          <div>
            <span className="eyebrow">बंपर ऑफर <i>·</i> THE BIG LITTLE DEAL</span>
            <h2>Something special is on its way.</h2>
            <p>Today’s Deal is being prepared. No active offer just yet.</p>
          </div>
          <div className="deal-countdown-preview" aria-label="Countdown preview, not active">
            <span>COUNTDOWN PREVIEW</span>
            <strong>-- <i>:</i> -- <i>:</i> --</strong>
            <small>NOT ACTIVE</small>
          </div>
        </div>
      </section>

      <ProductSection
        eyebrow="FRESH ON THE SHELVES"
        title="Latest arrivals"
        to="/products?sort=newest"
        result={latest.data}
        error={latest.error}
        loading={latest.loading}
      />

      <section className="closing-note page-shell">
        <span className="eyebrow">CHOTE MIYAN BADE MIYA</span>
        <p>Small discoveries can make a day.</p>
        <Link to="/products">See what’s here <ArrowUpRight size={16} /></Link>
      </section>
    </>
  );
}
