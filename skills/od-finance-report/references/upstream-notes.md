# 上游意图摘要（只读参考）

> 迁移自 Open Design；执行以本技能 SKILL.md 与 checklist 为准，忽略 OD daemon / DESIGN.md 强制问卷。

# Finance Report Skill

Produce a single-screen financial report in one self-contained HTML file.

## Workflow

1. **Read the active DESIGN.md.** Tables, KPI cards, and chart strokes use
   palette tokens — never invent new ones.
2. **Classify** the period (monthly / quarterly / yearly) and entity
   (startup, division, project) from the brief. If unspecified, assume a
   quarterly SaaS report and pick believable numbers.
3. **Layout** the page in this order:
   - Masthead: company / period / "Confidential — Finance" badge.
   - Headline KPI strip (4 cards): Revenue, Net new MRR, Gross margin, Cash runway.
   - Revenue trend chart (inline SVG line + area).
   - Cost breakdown chart (inline SVG bar) with a 2–3 bullet caption.
   - P&L summary table (Revenue / Gross profit / Opex / Net) with current vs prior period.
   - Top accounts table with logo placeholders, plan, ARR, status badge.
   - Outlook paragraph + footer with author + signature line.
4. **Write** one self-contained HTML doc (CSS in one inline `<style>` block).
5. **Self-check**: every number ties to a labelled chart or table; deltas
   show direction and percentage; accent colour used at most twice.

## Output contract

[代码块已省略]
