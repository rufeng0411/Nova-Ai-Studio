import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizePollutedPathHints,
  stripDeliverableAnnotation,
} from "../../src/saas/deliverables/deliverablePathHintSanitize.js";

test("drops phantom pathHint with Chinese sentence fragments", () => {
  const slots = [
    {
      id: "phantom",
      label: "个核心词与用户常问句式。须交付：keywords.md",
      pathHint: "个核心词与用户常问句式。须交付：keywords.md",
    },
    { id: "md", label: "keywords.md", pathHint: "keywords.md" },
  ];
  const out = sanitizePollutedPathHints(slots);
  assert.equal(out.length, 1);
  assert.equal(out[0].pathHint, "keywords.md");
});

test("first extension wins over 不要配图.html glue", () => {
  const slots = [{
    id: "html",
    label: "report.html不要配图.html",
    pathHint: "artifacts/task-x/report.html不要配图.html",
  }];
  const out = sanitizePollutedPathHints(slots);
  assert.equal(out[0].pathHint, "report.html");
});

test("dedupes double extension pptx.pptx", () => {
  const slots = [{ id: "ppt", label: "presentation.pptx", pathHint: "presentation.pptx.pptx" }];
  const out = sanitizePollutedPathHints(slots);
  assert.equal(out[0].pathHint, "presentation.pptx");
});

test("stripDeliverableAnnotation removes parens", () => {
  assert.equal(stripDeliverableAnnotation("keywords.md（含 20 词）"), "keywords.md");
});
