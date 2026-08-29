/* ============================================
   LOADINGSTATE
   Overlay shown during initial load, location
   detection, or a failed fetch — replaces what
   would otherwise be a blank black canvas while
   the app has nothing real to show yet.
============================================ */
interface LoadingStateProps {
  phase: 'locating' | 'loading' | 'error';
  message?: string;
  onRetry?: () => void;
}

const PHASE_TEXT: Record<LoadingStateProps['phase'], string> = {
  locating: 'Finding your sky…',
  loading: 'Loading the moment…',
  error: 'Something went wrong.',
};

export default function LoadingState({ phase, message, onRetry }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-state__content">
        {phase !== 'error' && <div className="loading-state__spinner" aria-hidden="true" />}

        <p className="loading-state__text">{message || PHASE_TEXT[phase]}</p>

        {phase === 'error' && onRetry && (
          <button type="button" onClick={onRetry} className="loading-state__retry">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
