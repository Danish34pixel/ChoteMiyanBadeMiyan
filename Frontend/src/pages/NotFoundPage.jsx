import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-shell not-found-page">
      <span className="eyebrow">THIS PAGE TOOK A DIFFERENT TURN</span>
      <strong className="not-found-code">404</strong>
      <h1>Nothing to see here.<br /><span>Let’s find something else.</span></h1>
      <Link className="button button-dark" to="/"><ArrowLeft size={16} /> Back home</Link>
      <Link className="not-found-secondary" to="/products">Browse products <ArrowUpRight size={15} /></Link>
    </div>
  );
}
