import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import Brand from '../../components/Brand.jsx';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user, adminLogin } = useAuth();
  const navigate = useNavigate();

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid administrator email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      await adminLogin({ email: normalizedEmail, password });
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-page">
      <Link to="/" className="admin-login-back">
        <ArrowLeft size={16} /> Storefront
      </Link>
      <section className="admin-login-card">
        <Brand />
        <span className="admin-login-mark"><ShieldCheck size={24} /></span>
        <span className="eyebrow">SECURE ADMIN ACCESS</span>
        <h1>Welcome to your store.</h1>
        <p className="admin-login-description">
          Sign in with the email and password assigned to your administrator account.
        </p>
        <form className="admin-form" onSubmit={submit}>
          <label className="admin-field">
            <span>Administrator email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="admin-field">
            <span>Password</span>
            <span className="auth-password-wrap">
              <input
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                required
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="auth-spinner" size={18} /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="admin-login-policy">
          Admin accounts are provisioned by a trusted operator.
        </p>
      </section>
    </div>
  );
}
