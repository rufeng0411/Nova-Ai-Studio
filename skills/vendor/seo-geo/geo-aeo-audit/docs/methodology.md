# Methodology — Per-Technique Attribution

Every rule, score weight, and evidence collector in this skill is traceable to a published source — peer-reviewed research, an open-source predecessor, or industry-validated practice.

## Composite Score (4 vectors)

| Vector | Default weight | Source |
|---|---|---|
| Technical Accessibility | 20% | Princeton KDD 2024 §3.2 — robots/AI bot access matrix |
| Content Citability | 35% | Princeton KDD 2024 §4 — "Cite Sources" lifts citation rate +115% |
| Structured Data | 20% | C-SEO Bench 2025 — schema rivals prose tweaks for AI citation |
| Entity & Brand Signals | 25% | Aggarwal et al. 2024 §5.3 — author/org markup |

Profile-adaptive weights override defaults per business profile (`saas`, `ecom`, `publisher`, `local`, `agency`, `devtools`, `academic`).

## Evidence collectors (33 total)

Each collector emits structured findings tagged with a Confidence label — `Confirmed` (directly observed), `Likely` (inferred from 2+ collectors), `Hypothesis` (LLM judgment, flagged for review). No score adjustment is applied without a label.

Full list: see [`scripts/`](../scripts/).

## Frameworks

- **CORE-EEAT** (80 items) — content quality benchmark, derived from Google's December 2025 Search Quality Rater Guidelines update
- **CITE** (40 items) — authority benchmark, derived from arxiv.org citation patterns
- **Princeton KDD 2024** ([arXiv:2311.09735](https://arxiv.org/abs/2311.09735)) — the foundational GEO research paper
- **AutoGEO** ([arXiv:2502.13392](https://arxiv.org/abs/2502.13392)) — automatic rule extraction extending Princeton

## Per-feature attribution

| Feature | Originated in | Adapted in |
|---|---|---|
| Multi-extension architecture | AgriciDaniel/claude-seo | Restructured into 7 sub-skills + 5 agents |
| 12-agent parallelism | AgriciDaniel/claude-seo | Reduced to 5 specialist agents (less overlap) |
| CORE-EEAT framework | aaron-he-zhu/seo-geo-claude-skills | Used verbatim |
| CITE framework | aaron-he-zhu/seo-geo-claude-skills | Used verbatim |
| Confidence labels | Bhanunamikaze/Agentic-SEO-Skill | Extended from 2-tier to 3-tier (Confirmed/Likely/Hypothesis) |
| 33 evidence collectors | Bhanunamikaze/Agentic-SEO-Skill | Re-implemented in zero-dep Python |
| MCP server | Auriti-Labs/geo-optimizer-skill | Local-only variant |
| Princeton KDD framework | Auriti-Labs/geo-optimizer-skill | Used verbatim with profile-adaptive weights added |
| 47-method optimization rulebook | Auriti-Labs/geo-optimizer-skill | Expanded to 100+ methods |
| IndexNow submission | 199-biotechnologies/claude-skill-seo-geo-optimizer | Used verbatim |
| Freshness monitoring | 199-biotechnologies/claude-skill-seo-geo-optimizer | Used verbatim |
| Entity extraction (Org, Person, sameAs) | 199-biotechnologies/claude-skill-seo-geo-optimizer | Extended to JSON-LD parser |

## License

Each predecessor project is MIT-licensed. This skill is also MIT.
