#!/usr/bin/env python3
"""
best-aeo-skill — audit orchestrator

Runs a full GEO audit against a URL. Computes the 0-100 composite GEO Score
across 4 vectors, returns confidence-labeled findings, projects fix impact.

Usage:
    python3 audit.py --url https://example.com [--profile saas] [--format json|markdown|html]

Vectors and default weights:
    - Technical Accessibility:  20%
    - Content Citability:        35%
    - Structured Data:           20%
    - Entity & Brand Signals:    25%

Weights adapt per profile (saas, ecommerce, publisher, local, agency, devtools, academic).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import urlparse

# Local imports — evidence collectors
from fetch_page import fetch_page
from robots_check import check_robots
from ai_bot_access import check_ai_bot_access
from schema_validate import detect_schemas
from statistic_density import measure_statistic_density
from citation_check import count_citations
from quote_extractor import extract_quotes
from freshness_check import check_freshness
from llms_txt_check import check_llms_txt
from entity_extractor import extract_entities
from author_check import check_author


# ============================================================
# Profile weights
# ============================================================

PROFILE_WEIGHTS: dict[str, dict[str, float]] = {
    "default":   {"technical": 0.20, "citability": 0.35, "schema": 0.20, "entity": 0.25},
    "saas":      {"technical": 0.18, "citability": 0.32, "schema": 0.25, "entity": 0.25},
    "ecommerce": {"technical": 0.18, "citability": 0.25, "schema": 0.32, "entity": 0.25},
    "publisher": {"technical": 0.15, "citability": 0.45, "schema": 0.20, "entity": 0.20},
    "local":     {"technical": 0.18, "citability": 0.25, "schema": 0.22, "entity": 0.35},
    "agency":    {"technical": 0.22, "citability": 0.35, "schema": 0.18, "entity": 0.25},
    "devtools":  {"technical": 0.25, "citability": 0.30, "schema": 0.25, "entity": 0.20},
    "academic":  {"technical": 0.18, "citability": 0.50, "schema": 0.12, "entity": 0.20},
}


# ============================================================
# Data structures
# ============================================================

@dataclass
class Finding:
    id: str
    severity: str           # "critical" | "high" | "medium" | "low"
    confidence: str         # "Confirmed" | "Likely" | "Hypothesis"
    category: str           # "technical" | "citability" | "schema" | "entity"
    rule: str               # e.g., "Rule 36" — points to SKILL.md ruleset
    message: str
    evidence: list[str] = field(default_factory=list)
    projected_impact: int = 0
    fix_command: str = ""


@dataclass
class VectorScore:
    score: int              # 0-100
    findings: list[Finding] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditResult:
    url: str
    profile: str
    geo_score: int
    score_band: str
    vectors: dict[str, VectorScore]
    findings: list[Finding]
    timestamp: float
    elapsed_seconds: float


# ============================================================
# Score band classification
# ============================================================

def classify_band(score: int) -> str:
    if score >= 86:
        return "Excellent"
    if score >= 68:
        return "Good"
    if score >= 36:
        return "Foundation"
    return "Critical"


# ============================================================
# Vector scorers — orchestrate the relevant evidence collectors
# ============================================================

def score_technical(html: str, url: str, fetch_meta: dict) -> VectorScore:
    """Score Technical Accessibility vector (default weight: 20%)."""
    findings: list[Finding] = []
    raw: dict[str, Any] = {}

    # robots.txt + AI bot allowance
    robots = check_robots(url)
    raw["robots"] = robots
    ai_access = check_ai_bot_access(url, robots=robots)
    raw["ai_access"] = ai_access

    # JS rendering proxy: compare HTML size vs lazy-load placeholders
    raw["html_size"] = len(html)

    # Score components
    score = 100
    if not robots["found"]:
        score -= 15
        findings.append(Finding(
            id="T-001", severity="medium", confidence="Confirmed",
            category="technical", rule="Rule 1",
            message="robots.txt not found at /robots.txt",
            evidence=["robots_check"],
            projected_impact=15,
            fix_command="bestaeo fix-robotstxt --url " + url,
        ))

    blocked_bots = [b for b, allowed in ai_access["bots"].items() if not allowed]
    if blocked_bots:
        # Per-bot penalty up to 30 points total
        penalty = min(30, len(blocked_bots) * 4)
        score -= penalty
        findings.append(Finding(
            id="T-002", severity="high", confidence="Confirmed",
            category="technical", rule="Rule 2",
            message=f"{len(blocked_bots)} AI bots not explicitly allowed: {', '.join(blocked_bots[:5])}",
            evidence=["ai_bot_access"],
            projected_impact=penalty,
            fix_command="bestaeo fix-robotstxt --url " + url,
        ))

    if fetch_meta.get("status") != 200:
        score -= 20
        findings.append(Finding(
            id="T-003", severity="critical", confidence="Confirmed",
            category="technical", rule="Rule 6",
            message=f"Page returned status {fetch_meta.get('status')}",
            evidence=["fetch_page"],
            projected_impact=20,
            fix_command="",
        ))

    score = max(0, min(100, score))
    return VectorScore(score=score, findings=findings, raw=raw)


def score_citability(html: str, url: str) -> VectorScore:
    """Score Content Citability vector (default weight: 35%)."""
    findings: list[Finding] = []
    raw: dict[str, Any] = {}

    stats = measure_statistic_density(html)
    raw["statistics"] = stats
    citations = count_citations(html, url)
    raw["citations"] = citations
    quotes = extract_quotes(html)
    raw["quotes"] = quotes
    freshness = check_freshness(html)
    raw["freshness"] = freshness

    score = 100

    # Rule 11: target 1 statistic per 200 words = density 0.5/100w
    word_count = stats["word_count"]
    stat_density_per_100 = stats["statistic_count"] / max(word_count, 1) * 100
    if word_count > 200:
        if stat_density_per_100 < 0.3:
            penalty = 20
            score -= penalty
            findings.append(Finding(
                id="C-001", severity="high", confidence="Confirmed",
                category="citability", rule="Rule 11",
                message=f"Low statistic density: {stats['statistic_count']} stats in {word_count} words "
                        f"({stat_density_per_100:.2f}/100w; target 0.5/100w). +40% visibility per Princeton KDD 2024.",
                evidence=["statistic_density"],
                projected_impact=penalty,
                fix_command="bestaeo fix-content --url " + url + " --apply",
            ))
        elif stat_density_per_100 < 0.5:
            penalty = 8
            score -= penalty
            findings.append(Finding(
                id="C-001b", severity="medium", confidence="Confirmed",
                category="citability", rule="Rule 11",
                message=f"Statistic density below target: {stat_density_per_100:.2f}/100w (target 0.5/100w).",
                evidence=["statistic_density"],
                projected_impact=penalty,
                fix_command="bestaeo fix-content --url " + url + " --apply",
            ))

    # Rule 13: 2-4 expert quotes per 1000 words
    quote_count = quotes["count"]
    if word_count > 800:
        target_quotes = max(2, word_count // 500)
        if quote_count < target_quotes - 1:
            penalty = 15
            score -= penalty
            findings.append(Finding(
                id="C-002", severity="high", confidence="Confirmed",
                category="citability", rule="Rule 13",
                message=f"Only {quote_count} expert quotes for {word_count} words "
                        f"(target: {target_quotes}). +41% citations per Princeton KDD 2024.",
                evidence=["quote_extractor"],
                projected_impact=penalty,
                fix_command="bestaeo fix-content --url " + url + " --apply",
            ))

    # Rule 12: every numeric claim must be cited
    if stats["statistic_count"] > 0 and citations["external_links"] < stats["statistic_count"] // 2:
        penalty = 12
        score -= penalty
        findings.append(Finding(
            id="C-003", severity="medium", confidence="Likely",
            category="citability", rule="Rule 12",
            message=f"{stats['statistic_count']} statistics but only {citations['external_links']} external citations. "
                    "Uncited stats are filtered out by Perplexity.",
            evidence=["statistic_density", "citation_check"],
            projected_impact=penalty,
            fix_command="bestaeo fix-content --url " + url + " --apply",
        ))

    # Rule 16: freshness — 3.2x more citations for content <30 days
    if freshness["age_days"] is not None:
        if freshness["age_days"] > 90:
            penalty = 10
            score -= penalty
            findings.append(Finding(
                id="C-004", severity="medium", confidence="Confirmed",
                category="citability", rule="Rule 16",
                message=f"Content is {freshness['age_days']} days old. Content <30 days receives 3.2× more citations.",
                evidence=["freshness_check"],
                projected_impact=penalty,
                fix_command="",
            ))
    else:
        penalty = 5
        score -= penalty
        findings.append(Finding(
            id="C-005", severity="low", confidence="Confirmed",
            category="citability", rule="Rule 17",
            message="No machine-readable dateModified found. Add ISO-8601 dateModified in JSON-LD.",
            evidence=["freshness_check"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --url " + url,
        ))

    score = max(0, min(100, score))
    return VectorScore(score=score, findings=findings, raw=raw)


def score_schema(html: str, url: str) -> VectorScore:
    """Score Structured Data vector (default weight: 20%)."""
    findings: list[Finding] = []
    raw: dict[str, Any] = {}

    schemas = detect_schemas(html)
    raw["schemas"] = schemas

    score = 100
    types = set(schemas["types"])

    # Rule 36: FAQPage = highest AI citation surface
    if "FAQPage" not in types:
        penalty = 25
        score -= penalty
        findings.append(Finding(
            id="S-001", severity="high", confidence="Confirmed",
            category="schema", rule="Rule 36",
            message="Missing FAQPage schema (highest AI citation surface).",
            evidence=["schema_validate"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --types faq --url " + url,
        ))

    # Rule 40: Article required fields (include all Schema.org Article subtypes)
    article_subtypes = {"Article", "BlogPosting", "NewsArticle", "TechArticle", "ScholarlyArticle", "Report", "AnalysisNewsArticle", "BackgroundNewsArticle", "OpinionNewsArticle", "ReportageNewsArticle", "ReviewNewsArticle", "AdvertiserContentArticle", "SatiricalArticle"}
    if not (types & article_subtypes):
        penalty = 15
        score -= penalty
        findings.append(Finding(
            id="S-002", severity="medium", confidence="Likely",
            category="schema", rule="Rule 40",
            message="No Article schema (or subtype) found. Required for content pages.",
            evidence=["schema_validate"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --types article --url " + url,
        ))

    # Rule 42: Organization required
    if "Organization" not in types:
        penalty = 10
        score -= penalty
        findings.append(Finding(
            id="S-003", severity="medium", confidence="Confirmed",
            category="schema", rule="Rule 42",
            message="No Organization schema with sameAs links to Wikidata/Wikipedia.",
            evidence=["schema_validate"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --types org --url " + url,
        ))

    if schemas.get("invalid_count", 0) > 0:
        penalty = 8
        score -= penalty
        findings.append(Finding(
            id="S-004", severity="medium", confidence="Confirmed",
            category="schema", rule="Rule 51",
            message=f"{schemas['invalid_count']} JSON-LD blocks have syntax errors.",
            evidence=["jsonld_lint"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --url " + url,
        ))

    score = max(0, min(100, score))
    return VectorScore(score=score, findings=findings, raw=raw)


def score_entity(html: str, url: str) -> VectorScore:
    """Score Entity & Brand vector (default weight: 25%)."""
    findings: list[Finding] = []
    raw: dict[str, Any] = {}

    entities = extract_entities(html)
    raw["entities"] = entities
    author = check_author(html)
    raw["author"] = author
    llms_txt = check_llms_txt(url)
    raw["llms_txt"] = llms_txt

    score = 100

    if not author["has_author"]:
        penalty = 20
        score -= penalty
        findings.append(Finding(
            id="E-001", severity="high", confidence="Confirmed",
            category="entity", rule="Rule 41",
            message="No author markup. Anonymous authorship reduces citation rate by ~60%.",
            evidence=["author_check"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --types person --url " + url,
        ))
    elif not author["has_credentials"]:
        penalty = 10
        score -= penalty
        findings.append(Finding(
            id="E-002", severity="medium", confidence="Likely",
            category="entity", rule="Rule 56",
            message="Author present but missing credentials/role/affiliation.",
            evidence=["author_check"],
            projected_impact=penalty,
            fix_command="bestaeo fix-content --url " + url + " --apply",
        ))

    # Rule 67: llms.txt
    if not llms_txt["found"]:
        penalty = 6
        score -= penalty
        findings.append(Finding(
            id="E-003", severity="low", confidence="Confirmed",
            category="entity", rule="Rule 67",
            message="No /llms.txt found. Anthropic honors this for ClaudeBot.",
            evidence=["llms_txt_check"],
            projected_impact=penalty,
            fix_command="bestaeo fix-llmstxt --base-url " + url,
        ))

    # Rule 58: sameAs links
    if entities["org"] and not entities.get("sameas_count", 0):
        penalty = 10
        score -= penalty
        findings.append(Finding(
            id="E-004", severity="medium", confidence="Likely",
            category="entity", rule="Rule 58",
            message="Organization detected but no sameAs links to Wikidata/Wikipedia/LinkedIn.",
            evidence=["entity_extractor"],
            projected_impact=penalty,
            fix_command="bestaeo fix-schema --types org --url " + url,
        ))

    score = max(0, min(100, score))
    return VectorScore(score=score, findings=findings, raw=raw)


# ============================================================
# Main orchestrator
# ============================================================

def run_audit(url: str, profile: str = "default") -> AuditResult:
    """Run a full audit against URL with the specified profile."""
    started = time.time()
    weights = PROFILE_WEIGHTS.get(profile, PROFILE_WEIGHTS["default"])

    # 1. Fetch
    fetch = fetch_page(url)
    html = fetch["html"]

    # 2. Score each vector (parallelizable in production)
    vec_tech = score_technical(html, url, fetch)
    vec_cite = score_citability(html, url)
    vec_schema = score_schema(html, url)
    vec_entity = score_entity(html, url)

    vectors = {
        "technical": vec_tech,
        "citability": vec_cite,
        "schema": vec_schema,
        "entity": vec_entity,
    }

    # 3. Composite GEO Score
    geo_score = round(
        vec_tech.score * weights["technical"]
        + vec_cite.score * weights["citability"]
        + vec_schema.score * weights["schema"]
        + vec_entity.score * weights["entity"]
    )

    # 4. Aggregate findings, sort by severity × confidence × projected_impact
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    confidence_order = {"Confirmed": 0, "Likely": 1, "Hypothesis": 2}
    all_findings = (
        vec_tech.findings + vec_cite.findings + vec_schema.findings + vec_entity.findings
    )
    all_findings.sort(key=lambda f: (
        severity_order.get(f.severity, 99),
        confidence_order.get(f.confidence, 99),
        -f.projected_impact,
    ))

    return AuditResult(
        url=url,
        profile=profile,
        geo_score=geo_score,
        score_band=classify_band(geo_score),
        vectors=vectors,
        findings=all_findings,
        timestamp=started,
        elapsed_seconds=round(time.time() - started, 2),
    )


# ============================================================
# Output formatters
# ============================================================

def format_markdown(r: AuditResult) -> str:
    lines: list[str] = []
    lines.append(f"# GEO Audit · {r.url}")
    lines.append("")
    lines.append(f"**GEO Score: {r.geo_score} / 100** ({r.score_band} tier) · profile: `{r.profile}` · {r.elapsed_seconds}s")
    lines.append("")
    lines.append("## Per-vector breakdown")
    lines.append("")
    lines.append("| Vector | Score |")
    lines.append("|--------|-------|")
    for name, vec in r.vectors.items():
        lines.append(f"| {name.title():<20} | {vec.score}/100 |")
    lines.append("")
    if not r.findings:
        lines.append("## No findings — site is in excellent shape.")
        return "\n".join(lines)
    lines.append(f"## Top findings ({len(r.findings)})")
    lines.append("")
    for i, f in enumerate(r.findings[:10], 1):
        lines.append(f"### {i}. [{f.confidence}] {f.message}")
        lines.append(f"  - **Severity:** {f.severity}  | **Rule:** {f.rule}  | **Projected impact:** +{f.projected_impact}")
        lines.append(f"  - **Evidence:** {', '.join(f.evidence)}")
        if f.fix_command:
            lines.append(f"  - **Fix:** `{f.fix_command}`")
        lines.append("")
    return "\n".join(lines)


def format_json(r: AuditResult) -> str:
    payload = {
        "url": r.url,
        "profile": r.profile,
        "geoScore": r.geo_score,
        "scoreBand": r.score_band,
        "elapsedSeconds": r.elapsed_seconds,
        "vectors": {
            name: {"score": vec.score, "findingCount": len(vec.findings), "raw": vec.raw}
            for name, vec in r.vectors.items()
        },
        "findings": [asdict(f) for f in r.findings],
    }
    return json.dumps(payload, indent=2, default=str)


def format_terminal(r: AuditResult) -> str:
    """Pretty terminal output with box-drawing characters."""
    lines: list[str] = []
    lines.append(f"GEO Score: {r.geo_score} / 100  ({r.score_band} tier)")
    lines.append("")
    icons = {"technical": "▎", "citability": "▎", "schema": "▎", "entity": "▎"}
    pretty_names = {
        "technical": "Technical Accessibility",
        "citability": "Content Citability    ",
        "schema": "Structured Data       ",
        "entity": "Entity & Brand Signals",
    }
    for name, vec in r.vectors.items():
        marker = "✓" if vec.score >= 80 else ("⚠" if vec.score >= 60 else "✗")
        first_finding_msg = vec.findings[0].message if vec.findings else "all checks passed"
        first_finding_msg = first_finding_msg[:70]
        lines.append(f"{icons[name]} {pretty_names[name]}    {vec.score}/100  {marker} {first_finding_msg}")
    lines.append("")
    confirmed = [f for f in r.findings if f.confidence == "Confirmed"]
    if confirmed:
        lines.append(f"# Top {min(3, len(confirmed))} fixes (Confirmed):")
        for i, f in enumerate(confirmed[:3], 1):
            lines.append(f"{i}. {f.message[:60]} — projected +{f.projected_impact} GEO score")
        lines.append("")
        lines.append("# Apply all in one command:")
        lines.append(f"$ bestaeo fix --url {r.url} --apply")
    return "\n".join(lines)


# ============================================================
# CLI
# ============================================================

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="best-aeo-skill audit — diagnose AI search visibility",
        epilog="See https://bestaeoskill.com for documentation.",
    )
    parser.add_argument("--url", required=True, help="URL to audit")
    parser.add_argument(
        "--profile",
        default="default",
        choices=list(PROFILE_WEIGHTS.keys()),
        help="Business profile for adaptive scoring (default: default)",
    )
    parser.add_argument(
        "--format",
        default="terminal",
        choices=["terminal", "markdown", "json"],
        help="Output format (default: terminal)",
    )
    parser.add_argument("--output", help="Write output to file instead of stdout")
    args = parser.parse_args(argv)

    # Validate URL
    parsed = urlparse(args.url)
    if not parsed.scheme or not parsed.netloc:
        print(f"Error: invalid URL: {args.url}", file=sys.stderr)
        return 2

    # Run
    try:
        result = run_audit(args.url, args.profile)
    except Exception as e:
        print(f"Audit failed: {e}", file=sys.stderr)
        return 1

    # Format
    if args.format == "json":
        out = format_json(result)
    elif args.format == "markdown":
        out = format_markdown(result)
    else:
        out = format_terminal(result)

    # Write
    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(out)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(out)

    # Exit code reflects severity (for CI/CD)
    has_critical = any(f.severity == "critical" for f in result.findings)
    return 1 if has_critical else 0


if __name__ == "__main__":
    sys.exit(main())
