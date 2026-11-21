import { Link } from 'react-router-dom';

export default function Brand({ footer = false }) {
  return (
    <Link
      className={`brand-mark${footer ? ' brand-mark-footer' : ''}`}
      to="/"
      aria-label="Chote Miyan Bade Miya home"
    >
      <img
        className="brand-logo-image"
        src="/brand-logo.png"
        alt="छोटे मियां बड़े मियां — Chote Miyan Bade Miya"
        width="663"
        height="875"
      />
      <span className="brand-name">
        <strong>Chote Miyan</strong>
        <strong>Bade Miya</strong>
        {!footer && <small>Everyday discoveries</small>}
      </span>
    </Link>
  );
}
