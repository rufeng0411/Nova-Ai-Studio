#!/usr/bin/env node
/**
 * PD-SAAS-FORK: emit Cursor canvas for hub capability name/visibility audit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const auditDir = path.join(root, 'artifacts/hub-capability-audit-20260812');
const rows = JSON.parse(fs.readFileSync(path.join(auditDir, 'rows-compact.json'), 'utf8'));
const renames = JSON.parse(fs.readFileSync(path.join(auditDir, 'p0-rename-unhide.json'), 'utf8')).renames;
const dups = JSON.parse(fs.readFileSync(path.join(auditDir, 'duplicate-display-names.json'), 'utf8')).slice(0, 20);

const canvasPath = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor/projects/f-Ai-pilotdeck/canvases/hub-capability-audit.canvas.tsx',
);

const src = `/* eslint-disable */
import { useMemo, useState } from "react";
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
} from "cursor/canvas";

/** [slug, display_zh, hidden_in_hub 0|1, not_shown 0|1, major] */
const ROWS: Array<[string, string, 0 | 1, 0 | 1, string]> = ${JSON.stringify(rows)};

const P0_FIXES: Array<{
  slug: string;
  current: string;
  propose: string;
  also_summary?: string;
  reason: string;
  unhide?: boolean;
}> = ${JSON.stringify(renames, null, 2)};

const TOP_DUPS: Array<{ name: string; count: number; slugs: string[] }> = ${JSON.stringify(dups, null, 2)};

const PAGE = 40;

export default function HubCapabilityAuditCanvas() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "shown" | "hidden" | "not_shown" | "bad_name">("bad_name");
  const [page, setPage] = useState(0);

  const stats = useMemo(() => {
    const total = ROWS.length;
    const hidden = ROWS.filter((r) => r[2] === 1).length;
    const notShown = ROWS.filter((r) => r[3] === 1).length;
    const shown = total - notShown;
    const bad = ROWS.filter((r) => /·专项|检索→|大纲→|能力·/.test(r[1])).length;
    return { total, hidden, notShown, shown, bad };
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return ROWS.filter((r) => {
      if (filter === "shown" && r[3] === 1) return false;
      if (filter === "hidden" && r[2] !== 1) return false;
      if (filter === "not_shown" && r[3] !== 1) return false;
      if (filter === "bad_name" && !/·专项|检索→|大纲→|能力·/.test(r[1])) return false;
      if (!qq) return true;
      return (
        r[0].toLowerCase().includes(qq) ||
        r[1].toLowerCase().includes(qq) ||
        r[4].toLowerCase().includes(qq)
      );
    });
  }, [q, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1200 }}>
      <Stack gap={6}>
        <H1>能力中心显示名 / 隐藏审计</H1>
        <Text tone="secondary" size="small">
          源：capabilities.catalog + i18n + hub-visibility · 共 {stats.total} 项 · 2026-08-12
        </Text>
      </Stack>

      <Callout tone="warning" title="结论先看这两例">
        <Text>
          「智能获客」并未 hidden_in_hub，卡名被写成「检索→抽取→表格版 MD」，试一下却仍写「Nova-智能获客」——用户以为被藏了。
          「网站一键成片」(hf-website-to-video) 在 pin 清单里，但 taxonomy 强制 hidden_in_hub=true；主入口 hf-hyperframes 显示成「HF·专项」。
        </Text>
      </Callout>

      <Grid columns={5} gap={12}>
        <Stat value={String(stats.total)} label="目录总数" />
        <Stat value={String(stats.shown)} label="用户可见" tone="success" />
        <Stat value={String(stats.hidden)} label="hidden_in_hub" />
        <Stat value={String(stats.notShown)} label="实际不显示" tone="warning" />
        <Stat value={String(stats.bad)} label="垃圾/过程名" tone="danger" />
      </Grid>

      <Card>
        <CardHeader>根因（三层叠加）</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text>
              1) i18n 自动中文：无 CJK 时用「前缀·专项」或截断 task_summary 前 12 字当 display_name（generate-capabilities-i18n + capabilityZhAuto）。
            </Text>
            <Text>
              2) curated 只写了 task_summary 未写 display_name（如 nova-customer-acquisition-leads / nova-ppt-aesthetic-slides），被截成过程句。
            </Text>
            <Text>
              3) 显隐双轨：hidden_in_hub（taxonomy）+ hub-visibility（整 Tab 关：开发/脑爆/教育/媒体/金融）+ 单 slug 关。pin 与 hidden 冲突时仍不显示。
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <H2>P0 直接改法（应立刻改）</H2>
      <Text tone="secondary" size="small">
        落地：capabilityZhAuto SLUG_ZH_OVERRIDE + generate-capabilities-i18n SKILL_ZH；hf-website-to-video 取消 hidden_in_hub。然后 npm run capabilities:gen。
      </Text>
      <Table
        headers={["slug", "当前中文名", "建议中文名", "动作", "原因"]}
        rows={P0_FIXES.map((f) => [
          f.slug,
          f.current,
          f.propose,
          f.unhide ? "改名+取消隐藏" : "改名",
          f.reason || "",
        ])}
        rowTone={P0_FIXES.map((f) => (f.unhide ? "warning" : undefined))}
      />

      <H2>重名 Top</H2>
      <Table
        headers={["重复中文名", "数量", "样例 slug"]}
        rows={TOP_DUPS.map((d) => [d.name, String(d.count), d.slugs.slice(0, 4).join(", ")])}
      />

      <Divider />

      <H2>全量能力表</H2>
      <Row gap={12} style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <Stack gap={4} style={{ minWidth: 220, flex: 1 }}>
          <Text size="small" tone="secondary">搜索 slug / 中文名 / major</Text>
          <TextInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(0);
            }}
            placeholder="如：获客、hf-、html"
          />
        </Stack>
        <Stack gap={4} style={{ minWidth: 180 }}>
          <Text size="small" tone="secondary">筛选</Text>
          <Select
            value={filter}
            onChange={(v) => {
              setFilter(v as typeof filter);
              setPage(0);
            }}
            options={[
              { label: "全部", value: "all" },
              { label: "用户可见", value: "shown" },
              { label: "hidden_in_hub", value: "hidden" },
              { label: "实际不显示", value: "not_shown" },
              { label: "垃圾/过程名", value: "bad_name" },
            ]}
          />
        </Stack>
        <Pill tone="neutral">{filtered.length} 项</Pill>
      </Row>

      <Table
        headers={["中文显示名", "slug", "hidden_in_hub", "不显示", "major"]}
        rows={slice.map((r) => [
          r[1],
          r[0],
          r[2] ? "是" : "否",
          r[3] ? "是" : "否",
          r[4] || "—",
        ])}
        rowTone={slice.map((r) => (r[3] ? "warning" : r[2] ? "neutral" : "success"))}
      />

      <Row gap={8} style={{ alignItems: "center" }}>
        <Text size="small" tone="secondary">
          第 {safePage + 1}/{pageCount} 页（每页 {PAGE}）
        </Text>
        <Spacer />
        <Pill
          tone={safePage <= 0 ? "neutral" : "info"}
          active={safePage > 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          上一页
        </Pill>
        <Pill
          tone={safePage >= pageCount - 1 ? "neutral" : "info"}
          active={safePage < pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        >
          下一页
        </Pill>
      </Row>

      <H3>配套文件</H3>
      <Text size="small" tone="secondary">
        artifacts/hub-capability-audit-20260812/all-capabilities.csv · p0-rename-unhide.json · duplicate-display-names.json
      </Text>
    </Stack>
  );
}
`;

fs.mkdirSync(path.dirname(canvasPath), { recursive: true });
fs.writeFileSync(canvasPath, src);
console.log(`[write-hub-capability-audit-canvas] wrote ${canvasPath} (${Buffer.byteLength(src)} bytes)`);
