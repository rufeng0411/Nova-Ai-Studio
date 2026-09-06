# Confidence Rubric — Anti-hallucination labeling

Every finding output by best-aeo-skill MUST carry exactly one of three labels.

## Confirmed
Directly observed by ≥1 evidence collector. Examples:
- HTTP response code present in trace
- DOM element absent in parsed HTML
- JSON-LD parser returned syntax error
- Header missing in HTTP response

When in doubt about confidence: prefer **Likely** over **Confirmed**. Confirmed should be unambiguous.

## Likely
Strong inference from ≥2 evidence collectors that agree, OR ≥1 collector with high specificity that maps to a known anti-pattern. Examples:
- schema_validate returned no FAQPage AND quote_extractor found Q&A patterns
- statistic_density returned 0.2/100 AND citability_score ≤ 50
- Multiple authors mentioned but Person schema absent
- robots.txt allows GPTBot but CDN blocks GPTBot fetch

## Hypothesis
LLM judgment, speculative recommendation, or single weak signal. Examples:
- Tone analysis suggesting voice mismatch
- Recommendations for future-proofing emerging engines
- Recommendations relying on user-only-knowable context

NEVER present a Hypothesis as a fix path without flagging human review needed.

## Why this matters
Other GEO/AEO tools present "issues" without proof, leading to action on hallucinated problems. best-aeo-skill labels every finding so users know how confident to be.
