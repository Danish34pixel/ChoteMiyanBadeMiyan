import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SectionHeading({ eyebrow, title, action, to }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && to && (
        <Link className="section-link" to={to}>
          {action} <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
