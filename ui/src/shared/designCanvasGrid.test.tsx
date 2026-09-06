import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignCanvasGrid from '../components/super-preview/adapters/designCanvas/DesignCanvasGrid';

describe('DesignCanvasGrid', () => {
  it('renders dot grid layer for infinite canvas chrome', () => {
    const { container } = render(
      <DesignCanvasGrid viewport={{ x: 12, y: 24, zoom: 1.25 }} />,
    );
    const root = container.firstElementChild as HTMLElement;
    const backgrounds = root.querySelectorAll('[style*="background"]');
    const styles = Array.from(backgrounds).map((el) => (el as HTMLElement).style.backgroundImage);
    expect(styles.some((s) => s.includes('radial-gradient'))).toBe(true);
    expect(styles.some((s) => s.includes('linear-gradient'))).toBe(true);
  });
});
