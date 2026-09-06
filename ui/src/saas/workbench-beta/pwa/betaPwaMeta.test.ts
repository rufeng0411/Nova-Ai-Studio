import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applyBetaPwaMeta, restoreBetaPwaMeta } from './betaPwaMeta';

describe('betaPwaMeta', () => {
  let themeMeta: HTMLMetaElement;

  beforeEach(() => {
    themeMeta = document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    themeMeta.setAttribute('content', '#111111');
    document.head.appendChild(themeMeta);
  });

  afterEach(() => {
    restoreBetaPwaMeta();
    themeMeta.remove();
  });

  it('applies and restores theme-color', () => {
    applyBetaPwaMeta(false);
    expect(themeMeta.getAttribute('content')).not.toBe('#111111');
    restoreBetaPwaMeta();
    expect(themeMeta.getAttribute('content')).toBe('#111111');
  });
});
