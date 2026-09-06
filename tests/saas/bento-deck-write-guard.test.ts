import { describe, expect, it } from "vitest";
import {
  isBentoDeckWritePath,
  validateBentoDeckWriteContent,
} from "../../src/saas/deliverables/bentoDeckWriteGuard.js";

const VALID_SHELL = `<!DOCTYPE html><html><body>
<script type="application/bento+json" id="bento-doc">
{"format":"bento/slides","size":{"width":1280,"height":720},"theme":{"background":"#111","color":"#fff","accent":"#f00","fontFamily":"sans-serif"},"slides":[{"id":"s1","elements":[]}]}
</script>
</body></html>`;

describe("bentoDeckWriteGuard", () => {
  it("detects bento deck paths under artifacts/", () => {
    expect(isBentoDeckWritePath("artifacts/task-1/deck.bento.html")).toBe(true);
    expect(isBentoDeckWritePath("artifacts/task-1/index.html")).toBe(false);
    expect(isBentoDeckWritePath("drafts/deck.bento.html")).toBe(false);
  });

  it("rejects plain HTML slides masquerading as bento", () => {
    const fake = "<!DOCTYPE html><html><body><div class=\"slide\">x</div></body></html>";
    const result = validateBentoDeckWriteContent("", fake);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/splice-bento-shell/i);
    }
  });

  it("accepts valid bento/slides doc", () => {
    expect(validateBentoDeckWriteContent("", VALID_SHELL).ok).toBe(true);
  });

  it("allows full replace when before file lacks bento doc", () => {
    const fake = '<!DOCTYPE html><html><body><div class="slide">x</div></body></html>';
    expect(validateBentoDeckWriteContent(fake, VALID_SHELL).ok).toBe(true);
  });
});
