import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';

const initialForm = {
  name: '',
  email: '',
  mobile: '',
  pinCode: '',
  city: '',
  state: '',
  addressLine: '',
  password: '',
  confirmPassword: '',
};

export default function SignupPage() {
  const [form, setForm] = useState(initialForm);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');

    const name = form.name.trim();
    const email = form.email.trim();
    if (
      !name ||
      !email ||
      !form.mobile.trim() ||
      !form.pinCode.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.addressLine.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError('Please complete every field, including your delivery address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(form.mobile.trim())) {
      setError('Enter your mobile number with country code, for example +919876543210.');
      return;
    }
    if (!/^\d{6}$/.test(form.pinCode.trim())) {
      setError('PIN code must contain 6 digits.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          name,
          email,
          password: form.password,
          address: {
            name,
            mobile: form.mobile.trim(),
            pinCode: form.pinCode.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            addressLine: form.addressLine.trim(),
          },
        },
      });
      navigate('/login', {
        replace: true,
        state: { message: `${response.message}. Please sign in to continue.` },
      });
    } catch (requestError) {
      setError(requestError.message || 'We could not create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <span className="eyebrow">JOIN THE FAMILY</span>
      <h2 className="auth-title">Create your account</h2>
      <p className="auth-description">A lovely little account for all your everyday finds.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>Full name</span>
          <input
            autoComplete="name"
            name="name"
            type="text"
            value={form.name}
            onChange={updateField}
            required
            maxLength={100}
          />
        </label>
        <label className="auth-field">
          <span>Email address</span>
          <input
            autoComplete="email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            required
          />
        </label>
        <div className="auth-address-heading">
          <strong>Delivery address</strong>
          <span>We’ll save this with your new account.</span>
        </div>
        <label className="auth-field">
          <span>Mobile number</span>
          <input
            autoComplete="tel"
            name="mobile"
            type="tel"
            inputMode="tel"
            placeholder="+919876543210"
            value={form.mobile}
            onChange={updateField}
            required
          />
          <small>Include your country code, such as +91.</small>
        </label>
        <label className="auth-field">
          <span>Address</span>
          <textarea
            autoComplete="street-address"
            name="addressLine"
            rows={3}
            value={form.addressLine}
            onChange={updateField}
            required
            maxLength={500}
          />
        </label>
        <div className="auth-address-row">
          <label className="auth-field">
            <span>PIN code</span>
            <input
              autoComplete="postal-code"
              name="pinCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={form.pinCode}
              onChange={updateField}
              required
            />
          </label>
          <label className="auth-field">
            <span>City</span>
            <input
              autoComplete="address-level2"
              name="city"
              type="text"
              value={form.city}
              onChange={updateField}
              required
              maxLength={100}
            />
          </label>
        </div>
        <label className="auth-field">
          <span>State</span>
          <input
            autoComplete="address-level1"
            name="state"
            type="text"
            value={form.state}
            onChange={updateField}
            required
            maxLength={100}
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <span className="auth-password-wrap">
            <input
              autoComplete="new-password"
              name="password"
              type={passwordVisible ? 'text' : 'password'}
              value={form.password}
              onChange={updateField}
              required
              minLength={8}
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
          <small>Use at least 8 characters.</small>
        </label>
        <label className="auth-field">
          <span>Confirm password</span>
          <input
            autoComplete="new-password"
            name="confirmPassword"
            type={passwordVisible ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={updateField}
            required
            minLength={8}
          />
        </label>
        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="auth-spinner" size={18} /> : null}
          {loading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
