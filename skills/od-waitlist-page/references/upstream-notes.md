# 上游意图摘要（只读参考）

> 迁移自 Open Design；执行以本技能 SKILL.md 与 checklist 为准，忽略 OD daemon / DESIGN.md 强制问卷。

# Waitlist Page Skill

Pre-launch pages are your first handshake with future users. This skill builds a focused, honest entrance: your brand identity, what you're making, one clear path to join the early list. No artificial scarcity, no fake countdown, no inflation tactics—just a clean, mobile-first vessel for genuine interest.

## Workflow

### Preflight: Load hardened template and brand foundation

0. **Load the brand identity** — Read `DESIGN.md` for the color system, font pairing, and spatial rules. This is your foundation. A waitlist page lives or dies by consistency with the brand it represents. If `DESIGN.md` is missing, ask the user to provide one before you proceed.
1. **Read and copy the reusable template** — Read `assets/template.html`. This template is the hardened seed for all outputs. Copy it to `index.html` as your base. Do not write HTML from scratch or deviate from this structure. The template has all required layout, form structure, decorations, focus styles, and accessibility scaffolding baked in.

### Steps: Token replacement with validation and escaping

2. **Map tokens from inputs** — For each placeholder in the template (e.g., `{{PRODUCT_NAME}}`, `{{BG_EXPRESSION}}`, `{{BORDER_EXPRESSION}}`, `{{LOGO_MARK}}`), follow the replacement rules below:
   - **Text tokens** (`{{PRODUCT_NAME}}`, `{{TAGLINE}}`): HTML-escape `<`, `>`, `&`, `"`, `'` before insertion into HTML text nodes or attribute values.
   - **HTML tokens** (`{{LOGO_MARK}}`): If using text initials, HTML-escape them by default. If using inline SVG, you must strictly sanitize it using an allowlist: strip `<script>` tags, event handlers (`on*`), `<foreignObject>`, external refs (`href`, `xlink:href`, `url()`), and any disallowed attributes/elements before insertion. If the SVG cannot be safely sanitized, fallback to escaped text initials. Never emit raw, unsanitized arbitrary HTML. Ensure any SVG scales cleanly within its container.
   - **Color expression tokens** (`{{BG_EXPRESSION}}`, `{{FG_EXPRESSION}}`, `{{ACCENT_EXPRESSION}}`, `{{DECO_EXPRESSION}}`, `{{STRIPE_EXPRESSION}}`, `{{SUCCESS_EXPRESSION}}`, `{{BORDER_EXPRESSION}}`, `{{BTN_LABEL_EXPRESSION}}`, `{{TICKER_BG_EXPRESSION}}`, `{{TICKER_FG_EXPRESSION}}`, `{{DECO_STROKE_EXPRESSION}}`, `{{LOGO_SHADOW_EXPRESSION}}`, `{{LOGO_FG_EXPRESSION}}`): Must strictly adhere to an explicit color grammar (`#hex`, `rgb`/`rgba`, `hsl`/`hsla`, `oklch`, or `color-mix()` using only local variables). Hard reject any input containing `;`, `{}`, `<`, `>`, comments (`/*`), `@`, `url(`, or external refs to prevent CSS injection. Do not wrap in `#` or add extra quotes. Examples: `rgba(196, 169, 154, 0.38)`, `color-mix(in srgb, var(--fg) 38%, transparent)`, `#FDE8DF`. Insert as-is into `:root` CSS variables. Derive `--success` from DESIGN.md if present; otherwise use the allowed fallback `#2D6A4F` only.
   - **Font name tokens** (`{{DISPLAY_FONT_CSS}}`, `{{BODY_FONT_CSS}}`): These are CSS font-family values, already quoted if they contain spaces (e.g., `'DM Sans'`, `Syne`). Insert as-is into `--font-display` and `--font-body` declarations; do NOT add extra quotes.
   - **Font URL tokens** (`{{DISPLAY_FONT_URL}}`, `{{BODY_FONT_URL}}`): Spaces must be encoded as `+` for the Google Fonts URL (e.g., `DM+Sans`, `IBM+Plex+Serif`). Validate the URL is well-formed before insertion.
3. **Verify token mapping rules** — All color tokens are now in CSS variables:
   - `--bg` = `{{BG_EXPRESSION}}` (e.g., `#FDE8DF`)
   - `--fg` = `{{FG_EXPRESSION}}` (e.g., `#1A1410`)
   - `--accent` = `{{ACCENT_EXPRESSION}}` (brand badge)
   - `--deco` = `{{DECO_EXPRESSION}}` (decoration primary)
   - `--deco-stripe` = `{{STRIPE_EXPRESSION}}` (accent stripe)
   - `--input-border` = `{{BORDER_EXPRESSION}}` (full CSS expression with opacity)
   - `--success` = `{{SUCCESS_EXPRESSION}}` or `#2D6A4F` fallback
   - `--btn-label` = `{{BTN_LABEL_EXPRESSION}}` (button text color for contrast)
   - `--ticker-bg` = `{{TICKER_BG_EXPRESSION}}` (animated ticker b
