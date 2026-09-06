# EU Code of Practice on AI-Generated Content — context for marketing teams

**Status as of June 2026:** the European Commission's AI Office is finalizing a **voluntary Code of Practice** to help providers and deployers of generative AI systems meet **AI Act Article 50 transparency obligations**, which become applicable on **2 August 2026**.

Source: [EU Digital Strategy — Code of Practice for AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) (page dated 22 May 2026).

This document is the canonical reference for any DMP skill that produces, validates, or distributes AI-generated marketing content into EU markets.

## What Article 50 actually requires

Two distinct obligations:

1. **Providers** of generative AI systems (the model builders — OpenAI, Anthropic, Google, etc.) must ensure outputs are marked in a **machine-readable format** detectable as AI-generated. Mark must be implemented "in the design of the AI system" and be "effective, interoperable, robust and reliable as far as technically feasible."
2. **Deployers** (the marketing teams, agencies, and platforms using those systems to produce content) must **disclose** that the content is AI-generated when:
   - It is a **deep fake** (image, audio, or video that appreciably resembles real persons, objects, places, etc.) — disclosure is mandatory, with an exception for editorial/artistic expression where the disclosure must not hamper the work.
   - It is **AI-generated text published to inform the public on matters of public interest** — unless the content has undergone human editorial review with editorial responsibility for publication.

Penalty for non-compliance: up to **€15 million or 3% of total worldwide annual turnover**, whichever is higher.

## How the Code of Practice is structured

The Code is being drafted by the AI Office through two working groups, mirroring the two obligations above:

| Working Group | Scope | Practical output |
|---|---|---|
| **WG1 — Providers** | Machine-readable marking and detection mechanisms for AI-generated outputs | Technical guidance on watermarks, manifests (C2PA), SynthID-like signals, and detection tooling. References C2PA-style assertions as the canonical machine-readable marking mechanism. |
| **WG2 — Deployers** | Deepfake disclosure + AI-generated text publication obligations | Practical disclosure-language templates, what counts as "editorial review" for the text-publication exception, examples of acceptable vs non-compliant disclosures |

Source: [EU Digital Strategy code-of-practice page (22 May 2026)](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content).

**Timeline:** final code targeted for **May–June 2026 publication**, ahead of the August 2026 applicability date.

**Voluntary status:** the Code is a **voluntary compliance tool** — it does not replace Article 50, it just provides a presumption-of-conformity path for signatories. If you don't sign, you still need to comply with Article 50 via your own mechanism.

## What this means for DMP-generated content (and SocialForge / ContentForge)

DMP is a **deployer**, not a provider. Article 50 deployer obligations apply when:

- The brand's target market includes any EU jurisdiction (check `brand.profile.json → target_markets` for any of: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE)
- AND the content is AI-generated (image, video, audio, or text-published-to-inform-public)
- AND the disclosure exception does not apply (no human editorial review with editorial responsibility, or the asset is a deep fake)

**Mandatory disclosure paths used by the plugin:**

1. **Machine-readable mark** — embed a C2PA manifest with the `c2pa.ai-disclosure` assertion (spec 2.4, April 2026). Use `/digital-marketing-pro:c2pa-metadata` or SocialForge `/socialforge:c2pa-sign`. This satisfies the WG1-aligned "machine-readable" half automatically.
2. **Human-readable disclosure on deepfakes** — for any AI-generated image/video/audio that resembles a real person or place: visible disclosure on the asset OR in the adjacent caption / alt text / publication metadata. DMP's content pipeline auto-adds this when `c2pa_auto_sign: true` is on for the brand and the generator emitted `ai-claim: ai-generated-content`.
3. **Editorial-review proof for AI-generated text** — if you're publishing long-form AI-written articles (ContentForge pipeline) to inform the public, the editorial-review exception applies only if a human editor signed off with editorial responsibility. ContentForge's quality-gate logs serve as evidence; keep them archived.

## When the Code is published in final form

The skills `c2pa-metadata` (DMP), `c2pa-sign` (SocialForge), `check` (DMP pre-publish gate), `contentforge` pipeline (CF), and any future regulatory-compliance skill should be updated to:

- Cite the final Code URL when available
- Adopt any final disclosure-language templates the AI Office publishes
- Note the brand's signatory status (if the brand or its parent company signs the Code, document it in `brand.profile.json → compliance.eu_code_of_practice_signatory: true`)

Until final publication, the C2PA `c2pa.ai-disclosure` + IPTC digital-source-type pairing already shipped by DMP / SocialForge is the most defensible deployer-side compliance mechanism — both are referenced positively in the WG1 draft guidance.

## Related skills

- `skills/c2pa-metadata/SKILL.md` (DMP) — embed C2PA manifest including 2.4 `c2pa.ai-disclosure` assertion
- `skills/c2pa-sign/SKILL.md` (SocialForge) — equivalent for social-media assets
- `skills/check/SKILL.md` (DMP) — pre-publish gate, includes EU-market compliance check
- `skills/context-engine/compliance-rules.md` — jurisdiction-specific compliance rules (16+ privacy laws, AI labelling rules, advertising standards)
- `skills/context-engine/industry-profiles.md` — industry-specific transparency expectations

## Primary references

- [EU Digital Strategy — Code of Practice for AI-generated content (page dated 22 May 2026)](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
- [EU AI Act Article 50 (Regulation (EU) 2024/1689)](https://artificialintelligenceact.eu/article/50/)
- [C2PA Specification 2.4 (April 2026)](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html) — `c2pa.ai-disclosure` assertion definition
