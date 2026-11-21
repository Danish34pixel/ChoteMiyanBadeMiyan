import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ImageOff, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ErrorState, LoadingState } from '../components/Feedback.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { useCatalog } from '../hooks/use-catalog.js';

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function imageUrl(image) {
  if (typeof image === 'string') return image;
  return image?.url;
}

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const { data, loading, error } = useCatalog(`/products/${encodeURIComponent(slug)}`);
  const product = data?.product;
  const [variantId, setVariantId] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = useMemo(
    () => product?.variants?.find((variant) => variant._id === variantId) || product?.variants?.[0],
    [product, variantId],
  );
  const images = selectedVariant?.images?.length ? selectedVariant.images : product?.images || [];
  const activeImage = images[selectedImage] || images[0];
  const currentPrice = selectedVariant?.sellingPrice ?? product?.sellingPrice;
  const originalPrice = selectedVariant?.originalPrice ?? product?.originalPrice;
  const stock = selectedVariant?.stock ?? product?.stock ?? 0;
  const available = stock > 0;

  if (loading) {
    return <div className="page-shell inner-page"><LoadingState label="Loading product details" /></div>;
  }
  if (error) {
    return <div className="page-shell inner-page"><ErrorState error={error} /></div>;
  }
  if (!product) {
    return <div className="page-shell inner-page"><ErrorState error={new Error('Product details are unavailable.')} /></div>;
  }

  return (
    <>
      <div className="page-shell product-detail-page">
        <div className="breadcrumb">
          <Link to="/products"><ArrowLeft size={14} /> All products</Link>
          <span>/</span>
          <strong>{product.name}</strong>
        </div>
        <div className="product-detail-layout">
          <div className="product-gallery">
            <div className="product-main-image">
              {activeImage && imageUrl(activeImage) ? (
                <motion.img
                  key={imageUrl(activeImage)}
                  src={imageUrl(activeImage)}
                  alt={activeImage.alt || product.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                />
              ) : (
                <div className="detail-image-placeholder">
                  <ImageOff size={34} strokeWidth={1.4} />
                  <span>Product image not available</span>
                </div>
              )}
              {product.featured && <span className="product-featured detail-featured">Curated</span>}
            </div>
            {images.length > 1 && (
              <div className="image-thumbnails" aria-label="Product images">
                {images.map((image, index) => (
                  <button
                    key={`${imageUrl(image)}-${index}`}
                    type="button"
                    className={index === selectedImage ? 'thumbnail-active' : ''}
                    aria-label={`Show product image ${index + 1}`}
                    onClick={() => setSelectedImage(index)}
                  >
                    {imageUrl(image) && <img src={imageUrl(image)} alt="" loading="lazy" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-copy">
            <span className="eyebrow">
              {product.category?.name || 'THE COLLECTION'}
              {product.subcategory?.name ? ` / ${product.subcategory.name}` : ''}
            </span>
            <h1>{product.name}</h1>
            <div className="detail-price-row">
              <strong>{formatPrice(currentPrice) || 'Price unavailable'}</strong>
              {originalPrice > currentPrice && <del>{formatPrice(originalPrice)}</del>}
              {originalPrice > currentPrice && (
                <span className="detail-discount">
                  {Math.round((1 - currentPrice / originalPrice) * 100)}% off
                </span>
              )}
            </div>
            {product.priceFrom !== undefined && product.variants?.length > 0 && (
              <span className="price-from-note">Price shown for the selected option</span>
            )}
            <div className={`stock-status${available ? '' : ' stock-unavailable'}`}>
              <span className="stock-dot" />
              {available ? 'Available' : 'Currently unavailable'}
              {available && <span className="stock-quantity">{stock} available</span>}
            </div>
            <p className="product-description">{product.description}</p>

            {product.variants?.length > 0 && (
              <fieldset className="variant-picker">
                <legend>Choose an option</legend>
                <div className="variant-options">
                  {product.variants.map((variant) => {
                    const attributes = Object.entries(variant.attributes || {})
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ');
                    return (
                      <button
                        key={variant._id || variant.sku}
                        type="button"
                        className={selectedVariant?._id === variant._id ? 'variant-selected' : ''}
                        aria-pressed={selectedVariant?._id === variant._id}
                        onClick={() => {
                          setVariantId(variant._id);
                          setSelectedImage(0);
                          setQuantity(1);
                        }}
                      >
                        <span>{attributes || variant.sku}</span>
                        <small>{variant.stock > 0 ? 'Available' : 'Unavailable'}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="detail-controls">
              <div className="quantity-control" aria-label="Quantity selector">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus size={15} />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= stock}
                  onClick={() => setQuantity((value) => Math.min(stock, value + 1))}
                >
                  <Plus size={15} />
                </button>
              </div>
              <button
                className="button button-dark add-to-bag"
                type="button"
                disabled
                title="Cart functionality will be available in a later phase"
              >
                <ShoppingBag size={18} /> Add to bag <span>Coming soon</span>
              </button>
            </div>
            <p className="cart-note">Cart functionality is being prepared for a future update.</p>
            <div className="product-meta">
              {product.sku && <span>SKU <strong>{product.sku}</strong></span>}
              {product.subcategory?.name && <span>Collection <strong>{product.subcategory.name}</strong></span>}
            </div>
            <Link className="detail-back-link" to="/products">
              Continue exploring <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
      {product.category?.slug && (
        <RelatedProducts category={product.category.slug} currentSlug={product.slug} />
      )}
    </>
  );
}

function RelatedProducts({ category, currentSlug }) {
  const { data, loading, error } = useCatalog(
    `/products?category=${encodeURIComponent(category)}&sort=newest&limit=5`,
  );
  const products = data?.products?.filter((product) => product.slug !== currentSlug).slice(0, 4) || [];
  if (!loading && !error && !products.length) return null;
  return (
    <section className="page-shell home-section related-section">
      <SectionHeading eyebrow="MORE TO EXPLORE" title="You might also like" action="View collection" to={`/categories/${encodeURIComponent(category)}`} />
      {loading ? <LoadingState label="Finding similar products" /> : error ? <ErrorState error={error} /> : <ProductGrid products={products} />}
    </section>
  );
}
