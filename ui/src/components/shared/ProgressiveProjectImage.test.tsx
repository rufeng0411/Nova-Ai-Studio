import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProgressiveProjectImage from './ProgressiveProjectImage';

describe('ProgressiveProjectImage', () => {
  it('shows thumbnail first and swaps to the full image after preload', () => {
    render(
      <ProgressiveProjectImage
        fullSrc="/full.png"
        thumbnailSrc="/thumb.webp"
        alt="slide"
        imageClassName="object-cover"
      />,
    );

    const visible = screen.getByAltText('slide') as HTMLImageElement;
    expect(visible.getAttribute('src')).toBe('/thumb.webp');

    const preload = screen.getByTestId('progressive-full-preload');
    fireEvent.load(preload);

    expect(visible.getAttribute('src')).toBe('/full.png');
  });

  it('can render thumbnail only without preloading the full image', () => {
    render(
      <ProgressiveProjectImage
        fullSrc="/full.png"
        thumbnailSrc="/thumb.webp"
        alt="rail"
        preloadFull={false}
      />,
    );

    const visible = screen.getByAltText('rail') as HTMLImageElement;
    expect(visible.getAttribute('src')).toBe('/thumb.webp');
    expect(screen.queryByTestId('progressive-full-preload')).toBeNull();
  });

  it('falls back to the full image when the thumbnail fails to load', () => {
    render(
      <ProgressiveProjectImage
        fullSrc="/full.png"
        thumbnailSrc="/thumb.webp"
        alt="legacy"
        preloadFull={false}
      />,
    );

    const visible = screen.getByAltText('legacy') as HTMLImageElement;
    expect(visible.getAttribute('src')).toBe('/thumb.webp');

    fireEvent.error(visible);

    expect(visible.getAttribute('src')).toBe('/full.png');
  });

  it('loads full content directly when fullMode is content', () => {
    render(
      <ProgressiveProjectImage
        fullSrc="/full.png"
        thumbnailSrc="/thumb.webp"
        fullMode="content"
        alt="canvas"
      />,
    );

    const visible = screen.getByAltText('canvas') as HTMLImageElement;
    expect(visible.getAttribute('src')).toBe('/full.png');
    expect(screen.queryByTestId('progressive-full-preload')).toBeNull();
  });

  it('calls onError only after the full image fails', () => {
    const onError = vi.fn();
    render(
      <ProgressiveProjectImage
        fullSrc="/full.png"
        thumbnailSrc="/thumb.webp"
        alt="both-fail"
        preloadFull={false}
        onError={onError}
      />,
    );

    const visible = screen.getByAltText('both-fail') as HTMLImageElement;
    fireEvent.error(visible);
    expect(visible.getAttribute('src')).toBe('/full.png');
    expect(onError).not.toHaveBeenCalled();

    fireEvent.error(visible);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
