import { AlertCircle, LoaderCircle, PackageSearch, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading the collection' }) {
  return (
    <div className="feedback-card" role="status" aria-live="polite">
      <LoaderCircle className="loading-icon" size={27} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="feedback-card feedback-error" role="alert">
      <AlertCircle size={25} />
      <div>
        <strong>We couldn’t load this right now.</strong>
        <p>{error?.message || 'Please try again in a moment.'}</p>
        {error?.requestId && <small>Reference: {error.requestId}</small>}
      </div>
      {onRetry && (
        <button className="text-button" type="button" onClick={onRetry}>
          <RefreshCw size={15} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here just yet', description }) {
  return (
    <div className="feedback-card">
      <PackageSearch size={28} />
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
