import { useState } from 'react';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Tags,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const navigation = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    setLogoutError('');
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      setLogoutError(error.message || 'Could not sign out.');
    }
  }

  return (
    <div className="admin-app">
      {sidebarOpen && (
        <button
          className="admin-backdrop"
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`admin-sidebar${sidebarOpen ? ' admin-sidebar-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <Brand />
          <button
            className="admin-sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="admin-workspace-label">STORE MANAGEMENT</div>
        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              <ChevronRight className="admin-nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-store-link">
            <ExternalLink size={16} />
            View storefront
          </Link>
          <div className="admin-identity">
            <span className="admin-avatar">{user?.name?.[0] ?? 'A'}</span>
            <span className="admin-identity-copy">
              <strong>Store admin</strong>
              <small>{user?.mobile}</small>
            </span>
            <button type="button" onClick={signOut} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
          {logoutError && (
            <p className="admin-inline-error" role="alert">{logoutError}</p>
          )}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-menu-toggle"
            type="button"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
          <div className="admin-topbar-title">
            <span className="admin-status-dot" />
            <span>Store administration</span>
          </div>
          <Link className="admin-topbar-store" to="/">Visit store <Boxes size={16} /></Link>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
