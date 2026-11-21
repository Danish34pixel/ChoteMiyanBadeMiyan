import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const signedInUser = await login({ email: email.trim(), password });
      const requestedPath = location.state?.from?.pathname;
      const destination = signedInUser.role === 'admin'
        ? requestedPath?.startsWith('/admin')
          ? requestedPath
          : '/admin'
        : requestedPath || '/';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'We could not sign you in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <span className="eyebrow">WELCOME BACK</span>
      <h2 className="auth-title">Log in to your account</h2>
      <p className="auth-description">Pick up where your next good find begins.</p>
      {location.state?.message && (
        <p className="auth-message auth-message-success" role="status">
          {location.state.message}
        </p>
      )}
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>Email address</span>
          <input
            autoComplete="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <span className="auth-password-wrap">
            <input
              autoComplete="current-password"
              name="password"
              type={passwordVisible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="auth-spinner" size={18} /> : null}
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <p className="auth-switch">
        New to Chote Miyan Bade Miya? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
