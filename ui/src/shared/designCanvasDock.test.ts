import { describe, expect, it } from 'vitest';
import { buildDesignCanvasFileOpenOptions, openDesignCanvasInSidebar } from './designCanvasDock';

describe('designCanvasDock', () => {
  it('returns edit options only when gate and file type allow', () => {
    localStorage.setItem('pilotdeck-design-canvas-enabled', '1');
    const opts = buildDesignCanvasFileOpenOptions('hero.png', 'artifacts/campaign/hero.png', {
      designCanvasMode: 'edit',
    });
    expect(opts?.designCanvasMode).toBe('edit');
    localStorage.setItem('pilotdeck-design-canvas-enabled', '0');
    expect(buildDesignCanvasFileOpenOptions('hero.png', 'artifacts/campaign/hero.png')).toBeUndefined();
  });

  it('openDesignCanvasInSidebar delegates to onFileOpen', () => {
    localStorage.setItem('pilotdeck-design-canvas-enabled', '1');
    let opened: string | null = null;
    const ok = openDesignCanvasInSidebar((path) => {
      opened = path;
    }, 'artifacts/campaign/hero.png', 'hero.png', { hintDir: 'artifacts/campaign' });
    expect(ok).toBe(true);
    expect(opened).toBe('artifacts/campaign/hero.png');
  });
});
