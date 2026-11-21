import { useState } from 'react';
import { ArrowRight, LogOut, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Shop all', to: '/products' },
  { label: 'Categories', to: '/categories' },
];

export default function SiteHeader() {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function submitSearch(event) {
    event.preventDefault();
    const value = query.trim();
    if (value) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
      setMenuOpen(false);
    }
  }

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
    } catch (error) {
      setLogoutError(error.message || 'Could not complete sign out.');
    }
  }

  return (
    <header className="site-header">
      <div className="topline">
        <span className="topline-mark">✳</span>
        <span>आपका स्वागत है <i>·</i> Welcome to Chote Miyan Bade Miya</span>
        <span className="topline-mark">✳</span>
      </div>
      <div className="header-main page-shell">
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <Brand />
        <form className="search-form" role="search" onSubmit={submitSearch}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search products"
            placeholder="Search for something you love..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" aria-label="Submit search">
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="header-actions">
          {user ? (
            <button
              className="header-action"
              type="button"
              onClick={handleLogout}
              aria-label={`Sign out ${user.name}`}
              title={logoutError || `Signed in as ${user.email}`}
            >
              <LogOut size={20} strokeWidth={1.7} />
              <span>Sign out</span>
            </button>
          ) : (
            <Link className="header-action" to="/login">
              <UserRound size={20} strokeWidth={1.7} />
              <span>Account</span>
            </Link>
          )}
          <button
            className="header-action"
            type="button"
            title="Cart features are not available yet"
            disabled
          >
            <span className="bag-icon">
              <ShoppingBag size={20} strokeWidth={1.7} />
              <span className="bag-count">0</span>
            </span>
            <span>Bag</span>
          </button>
        </div>
      </div>
      <nav className={`main-nav${menuOpen ? ' main-nav-open' : ''}`} aria-label="Main navigation">
        <div className="page-shell nav-inner">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              end={item.to === '/'}
              to={item.to}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <Link className="nav-deal-link" to="/products?featured=true">
            Curated picks <span>✦</span>
          </Link>
        </div>
      </nav>
      {logoutError && <p className="header-auth-error" role="alert">{logoutError}</p>}
    </header>
  );
}
