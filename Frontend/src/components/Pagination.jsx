import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Product pages">
      <button
        type="button"
        className="pagination-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={17} />
      </button>
      <span>Page <strong>{page}</strong> of {pages}</span>
      <button
        type="button"
        className="pagination-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={17} />
      </button>
    </nav>
  );
}
