import { ArrowUpRight, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function ProductCard({ product, index = 0 }) {
  const price = product.priceFrom ?? product.sellingPrice;
  const image = product.images?.[0];
  const discount =
    product.originalPrice > price
      ? Math.round((1 - price / product.originalPrice) * 100)
      : 0;

  return (
    <motion.article
      className="product-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.035, 0.24) }}
      whileHover={{ y: -3 }}
    >
      <Link
        className="product-card-image"
        to={`/products/${encodeURIComponent(product.slug)}`}
        aria-label={`View ${product.name}`}
      >
        {image?.url ? (
          <img src={image.url} alt={image.alt || product.name} loading="lazy" />
        ) : (
          <span className="image-placeholder">
            <ImageOff size={23} strokeWidth={1.5} />
            <span>Image coming soon</span>
          </span>
        )}
        {discount > 0 && <span className="product-badge">{discount}% off</span>}
        {product.featured && <span className="product-featured">Curated</span>}
        <span className="product-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </Link>
      <div className="product-card-copy">
        <span className="product-category">
          {product.category?.name || 'Selected for you'}
        </span>
        <Link className="product-card-title" to={`/products/${encodeURIComponent(product.slug)}`}>
          {product.name}
        </Link>
        <div className="product-price-row">
          <strong>{formatPrice(price) || 'Price unavailable'}</strong>
          {product.originalPrice > price && (
            <del>{formatPrice(product.originalPrice)}</del>
          )}
        </div>
        {product.variants?.length > 0 && (
          <span className="variant-count">{product.variants.length} options</span>
        )}
      </div>
    </motion.article>
  );
}
