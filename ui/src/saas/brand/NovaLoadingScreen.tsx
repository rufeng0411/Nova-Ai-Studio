/**
 * PD-SAAS-FORK: Immersive Nova loading — fullscreen boot / fill-area session load.
 */
import novaLogoMark from './novaLogoMark';
import '../theme/novaLoadingScreen.css';

export type NovaLoadingScreenProps = {
  /** Override logo asset (default nova mark). */
  logoSrc?: string;
  /** Visible status line; omit for logo-only (aria-label still required via label). */
  label?: string;
  /** 0–100 shows determinate bar; omit shows indeterminate shimmer when showProgressBar. */
  progress?: number;
  mode?: 'fullscreen' | 'fill';
  /** Bottom progress track; defaults true for fullscreen, false for fill. */
  showProgressBar?: boolean;
  className?: string;
  /** Accessible name when label is hidden. */
  ariaLabel?: string;
};

export default function NovaLoadingScreen({
  logoSrc = novaLogoMark,
  label,
  progress,
  mode = 'fullscreen',
  showProgressBar,
  className = '',
  ariaLabel,
}: NovaLoadingScreenProps) {
  const trackVisible = showProgressBar ?? mode === 'fullscreen';
  const showProgress = progress !== undefined;
  const progressWidth = showProgress ? Math.max(6, Math.min(100, progress)) : undefined;
  const busy = !showProgress || (progress ?? 0) < 100;

  return (
    <div
      className={`nova-load nova-load--${mode} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-label={ariaLabel ?? label ?? 'Loading'}
    >
      <div className="nova-load-ambient" aria-hidden>
        <div className="nova-load-aurora nova-load-aurora--1" />
        <div className="nova-load-aurora nova-load-aurora--2" />
        <div className="nova-load-aurora nova-load-aurora--3" />
        <div className="nova-load-grid" />
        <div className="nova-load-scan" />
        <div className="nova-load-vignette" />
      </div>

      <div className="nova-load-core">
        <div className="nova-load-mark">
          <div className="nova-load-glow" aria-hidden />
          <div className="nova-load-orbit" aria-hidden>
            <svg viewBox="0 0 88 88" aria-hidden>
              <defs>
                <linearGradient id="nova-load-orbit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
                  <stop offset="50%" stopColor="hsl(var(--primary) / 0.95)" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.2)" />
                </linearGradient>
              </defs>
              <circle className="nova-load-orbit-track" cx="44" cy="44" r="36" />
              <circle className="nova-load-orbit-arc" cx="44" cy="44" r="36" />
            </svg>
          </div>
          <img src={logoSrc} alt="" className="nova-load-logo" draggable={false} />
        </div>

        {label ? (
          <p className="nova-load-label">
            {label}
            <span className="nova-load-dots" aria-hidden>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : null}

        {trackVisible ? (
          <div
            className={`nova-load-track${showProgress && progressWidth !== undefined ? '' : ' nova-load-track--indeterminate'}`}
            aria-hidden
          >
            <div
              className="nova-load-track-fill"
              style={showProgress && progressWidth !== undefined ? { width: `${progressWidth}%` } : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
