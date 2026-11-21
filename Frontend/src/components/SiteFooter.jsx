import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-grid">
        <div className="footer-brand-block">
          <Brand footer />
          <p>A considered collection, ready to be explored.</p>
        </div>
        <div className="footer-links">
          <h2>Explore</h2>
          <Link to="/categories">Categories</Link>
          <Link to="/products">All products</Link>
          <Link to="/search?q=">Search</Link>
        </div>
        <div className="footer-links">
          <h2>Information</h2>
          <span>About us</span>
          <span>Contact</span>
          <span>Privacy policy</span>
          <span>Terms &amp; conditions</span>
        </div>
        <div className="footer-note">
          <span className="eyebrow">A NOTE FROM US</span>
          <p>Everyday discoveries, with a little more character.</p>
          <ArrowUpRight size={19} aria-hidden="true" />
        </div>
      </div>
      <div className="page-shell footer-social-row">
        <span>FIND US ON</span>
        <a
          href="https://www.instagram.com/chotemiya.bademiya/"
          target="_blank"
          rel="noreferrer"
          aria-label="Chote Miyan Bade Miya on Instagram"
        >
          @chotemiya.bademiya <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="page-shell footer-bottom">
        <span>© {new Date().getFullYear()} Chote Miyan Bade Miya</span>
        <span>Made for discovery</span>
      </div>
    </footer>
  );
}
