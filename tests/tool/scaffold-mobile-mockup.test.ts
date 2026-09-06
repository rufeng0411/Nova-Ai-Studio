import assert from "node:assert/strict";
import test from "node:test";
import { buildScaffoldFiles } from "../../src/tool/builtin/mobileMockupTemplates.js";

test("fifa-world-cup preset produces complete html documents", () => {
  const files = buildScaffoldFiles("fifa-world-cup", 3);
  assert.equal(files.size, 4);
  const index = files.get("index.html") ?? "";
  assert.match(index, /<\/html>/i);
  assert.match(index, /screen-1\.html/);
  for (let i = 1; i <= 3; i += 1) {
    const screen = files.get(`screen-${i}.html`) ?? "";
    assert.match(screen, /<\/html>/i, `screen-${i} must be complete`);
    assert.doesNotMatch(screen, /linear-gradient\([^)]*$/);
  }
});
