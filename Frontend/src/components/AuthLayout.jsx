import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel" aria-label="Chote Miyan Bade Miya">
        <Brand />
        <div className="auth-brand-copy">
          <span className="eyebrow">A LITTLE JOY, EVERY DAY</span>
          <h1>Find the good things in everyday.</h1>
          <p>Thoughtful finds, familiar comforts, and a little something for everyone.</p>
        </div>
        <img
          className="auth-brand-art"
          src="/brand-logo.png"
          alt="Chote Miyan Bade Miya brand artwork"
          width="663"
          height="875"
        />
        <span className="auth-brand-caption">छोटे मियां बड़े मियां <i>·</i> Since 2024</span>
      </aside>
      <main className="auth-main">
        <Link className="auth-back-link" to="/">Back to the store</Link>
        <section className="auth-card" aria-label="Customer account">
          {children}
        </section>
        <p className="auth-privacy-note">Your account details are kept private and secure.</p>
      </main>
    </div>
  );
}
