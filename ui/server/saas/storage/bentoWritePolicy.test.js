import { describe, expect, it } from 'vitest';
import {
  isBentoDeckWritePath,
  validateBentoDeckWrite,
  BENTO_DECK_MAX_BYTES,
} from './bentoWritePolicy.js';

const SHELL = `<!DOCTYPE html><html><body>
<script type="application/bento+json" id="bento-doc">
{"format":"bento/slides","version":1,"title":"T","size":{"width":1280,"height":720},"theme":{"background":"#101418","color":"#fff","accent":"#f00","fontFamily":"system-ui"},"slides":[{"id":"s1","notes":"n","elements":[]}]}
</script>
<!-- shell marker -->
</body></html>`;

describe('bentoWritePolicy', () => {
  it('detects bento deck paths', () => {
    expect(isBentoDeckWritePath('artifacts/task-20260728-abc/deck.bento.html')).toBe(true);
    expect(isBentoDeckWritePath('artifacts/task-20260728-abc/index.html')).toBe(false);
  });

  it('allows doc json updates within shell', () => {
    const after = SHELL.replace(
      '"title":"T"',
      '"title":"Updated"',
    );
    const validation = validateBentoDeckWrite(SHELL, after);
    expect(validation.ok).toBe(true);
  });

  it('allows replacing fake static html with valid bento shell', () => {
    const fake = '<!DOCTYPE html><html><body><div class="slide">x</div></body></html>';
    const validation = validateBentoDeckWrite(fake, SHELL);
    expect(validation.ok).toBe(true);
  });

  it('rejects shell structure changes', () => {
    const after = SHELL.replace('<!-- shell marker -->', '<!-- tampered -->');
    const validation = validateBentoDeckWrite(SHELL, after);
    expect(validation.ok).toBe(false);
  });

  it('enforces max bytes', () => {
    const huge = 'x'.repeat(BENTO_DECK_MAX_BYTES + 1);
    const validation = validateBentoDeckWrite('', huge);
    expect(validation.ok).toBe(false);
  });
});
