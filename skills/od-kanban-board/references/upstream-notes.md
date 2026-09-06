# 上游意图摘要（只读参考）

> 迁移自 Open Design；执行以本技能 SKILL.md 与 checklist 为准，忽略 OD daemon / DESIGN.md 强制问卷。

# Kanban Board Skill

Produce a single-screen kanban board.

## Workflow

1. Read the active DESIGN.md.
2. Identify squad name, sprint number, columns, and member roster from the brief.
3. Layout:
   - Top bar: project crumb, sprint chip, filter row (members, labels, status), search.
   - 4 columns: Backlog, In progress, In review, Done. Each column has a count chip and an "+ add" affordance.
   - 3–6 cards per column. Each card: tag chip, title, assignee avatar, point estimate, progress (if applicable).
   - Sidebar (collapsible feel): "Sprint pulse" with progress bar, top assignees, blocked-tickets callout.
4. One inline `<style>`, semantic HTML.

## Output contract

[代码块已省略]
