interface SelfCheckOverlayProps {
  message: string;
}

export function SelfCheckOverlay({ message }: SelfCheckOverlayProps) {
  const text = message.trim() || '正在自检，请稍后…';

  return (
    <div className="self-check-overlay" role="alertdialog" aria-modal="true" aria-busy="true" aria-live="polite">
      <div className="self-check-card">
        <div className="self-check-spinner" aria-hidden />
        <p className="self-check-title">{text}</p>
        <p className="self-check-hint">环境自检进行中，请勿操作，完成后自动继续</p>
      </div>
    </div>
  );
}
