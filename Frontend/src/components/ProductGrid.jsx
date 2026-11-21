import { EmptyState } from './Feedback.jsx';
import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ products = [], emptyTitle, emptyDescription }) {
  if (!products.length) {
    return (
      <EmptyState
        title={emptyTitle || 'No products found'}
        description={emptyDescription || 'Try another category or adjust your filters.'}
      />
    );
  }

  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard key={product._id || product.slug} product={product} index={index} />
      ))}
    </div>
  );
}
