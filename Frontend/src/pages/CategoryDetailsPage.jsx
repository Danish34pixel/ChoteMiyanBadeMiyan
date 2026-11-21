import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/Feedback.jsx';
import { useCatalog } from '../hooks/use-catalog.js';
import ProductListingPage from './ProductListingPage.jsx';
import { localImageUrl } from '../admin/admin-utils.js';

export default function CategoryDetailsPage() {
  const { slug } = useParams();
  const { data, loading, error } = useCatalog(`/categories/${encodeURIComponent(slug)}`);

  if (loading) return <div className="page-shell inner-page"><LoadingState label="Loading collection" /></div>;
  if (error) return <div className="page-shell inner-page"><ErrorState error={error} /></div>;

  const category = data?.category;

  return (
    <>
      <div className="page-shell category-detail-intro">
        <div className="breadcrumb"><Link to="/categories"><ArrowLeft size={14} /> All categories</Link><span>/</span><strong>{category?.name}</strong></div>
        <div className="category-detail-heading">
          <div className="page-intro page-intro-compact">
            <span className="eyebrow">EXPLORE THE COLLECTION</span>
            <h1>{category?.name}</h1>
            {category?.description && <p>{category.description}</p>}
          </div>
          {category?.image && (
            <img
              className="category-detail-image"
              src={localImageUrl(category.image)}
              alt={category.name}
            />
          )}
        </div>
      </div>
      <ProductListingPage categorySlug={slug} categoryName={category?.name} />
    </>
  );
}
