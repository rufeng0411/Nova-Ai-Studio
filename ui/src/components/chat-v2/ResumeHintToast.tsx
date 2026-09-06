// PD-SAAS-FORK: weak toast when auto-resume continues a task
import { useEffect, useState } from 'react';

export type ResumeHintToastProps = {
  message: string;
  visible: boolean;
  durationMs?: number;
  onDismiss?: () => void;
};

export function ResumeHintToast({
  message,
  visible,
  durationMs = 3000,
  onDismiss,
}: ResumeHintToastProps) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
    if (!visible) return undefined;
    const timer = setTimeout(() => {
      setShow(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!show || !message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md bg-muted/90 px-3 py-2 text-xs text-muted-foreground shadow-sm"
      role="status"
    >
      {message}
    </div>
  );
}

export default ResumeHintToast;
