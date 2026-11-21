import { ArrowUpRight, Shapes } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localImageUrl } from '../admin/admin-utils.js';

export default function CategoryTile({ category, index = 0 }) {
  return (
    <Link
      className={`category-tile category-tone-${index % 4}`}
      to={`/categories/${encodeURIComponent(category.slug)}`}
    >
      <span className="category-symbol">
        {category.image ? (
          <img src={localImageUrl(category.image)} alt="" loading="lazy" />
        ) : (
          <Shapes size={25} strokeWidth={1.4} />
        )}
      </span>
      <span className="category-tile-copy">
        <strong>{category.name}</strong>
        <span>Explore collection</span>
      </span>
      <ArrowUpRight size={19} className="category-arrow" />
    </Link>
  );
}
