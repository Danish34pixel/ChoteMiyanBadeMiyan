import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CategoryTile from '../components/CategoryTile.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { useCatalog } from '../hooks/use-catalog.js';
import { queryString } from '../lib/api.js';

export default function CategoriesPage() {
  const { data, loading, error } = useCatalog(`/categories${queryString({ limit: 100 })}`);

  return (
    <div className="page-shell inner-page">
      <div className="page-intro">
        <span className="eyebrow">A PLACE FOR EVERY INTEREST</span>
        <h1>Find your kind of <span>something.</span></h1>
        <p>Explore the collections, and see where you end up.</p>
      </div>
      <SectionHeading eyebrow="THE COLLECTIONS" title="Browse all categories" />
      {loading ? (
        <LoadingState label="Loading categories" />
      ) : error ? (
        <ErrorState error={error} />
      ) : data?.categories?.length ? (
        <div className="category-grid category-grid-large">
          {data.categories.map((category, index) => (
            <CategoryTile key={category._id || category.slug} category={category} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState title="No categories to show yet" description="New collections will appear here when they are available." />
      )}
      <div className="inline-explore">
        <span>Not sure where to start?</span>
        <Link to="/products">Explore all products <ArrowUpRight size={16} /></Link>
      </div>
    </div>
  );
}
