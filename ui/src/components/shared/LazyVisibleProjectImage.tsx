import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from '../../lib/utils';
import ProgressiveProjectImage from './ProgressiveProjectImage';

type LazyVisibleProjectImageProps = ComponentProps<typeof ProgressiveProjectImage> & {
  /** Always load immediately (e.g. active slide in sidebar). */
  forceVisible?: boolean;
  placeholderClassName?: string;
};

// PD-SAAS-FORK: defer off-screen slide thumbnails so Super Preview does not flood Bridge.
export default function LazyVisibleProjectImage({
  forceVisible = false,
  className = '',
  placeholderClassName = '',
  ...imageProps
}: LazyVisibleProjectImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceVisible);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      return undefined;
    }
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [forceVisible]);

  return (
    <div ref={ref} className={cn('relative block overflow-hidden', className)}>
      {visible ? (
        <ProgressiveProjectImage
          {...imageProps}
          className="h-full w-full"
        />
      ) : (
        <div
          className={cn(
            'aspect-video w-full animate-pulse rounded bg-muted',
            placeholderClassName,
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
