import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSessionInfoFromLite } from "../../../src/session/storage/SessionList.js";
import type { SessionLiteFile } from "../../../src/session/storage/SessionLiteReader.js";

function acceptedInputLine(text: string): string {
  return JSON.stringify({
    type: "accepted_input",
    messages: [{ content: [{ type: "text", text }] }],
  });
}

function metadataLine(fields: Record<string, string>): string {
  return JSON.stringify({
    type: "session_metadata",
    metadata: fields,
  });
}

function liteFromLines(headLines: string[], tailLines: string[] = []): SessionLiteFile {
  const head = headLines.join("\n");
  const tail = tailLines.length > 0 ? tailLines.join("\n") : head;
  return {
    path: "/tmp/test.jsonl",
    mtime: Date.now(),
    size: head.length + tail.length,
    head,
    tail,
  };
}

describe("parseSessionInfoFromLite title freeze", () => {
  it("keeps first user prompt as summary after later turns", () => {
    const lite = liteFromLines(
      [acceptedInputLine("帮我做韩国市场 PPT")],
      [acceptedInputLine("继续完善第二页")],
    );
    const info = parseSessionInfoFromLite("web-s_test", lite);
    assert.ok(info);
    assert.equal(info.summary, "帮我做韩国市场 PPT");
    assert.equal(info.firstPrompt, "帮我做韩国市场 PPT");
  });

  it("uses first aiTitle metadata, not later rewrites", () => {
    const lite = liteFromLines(
      [
        acceptedInputLine("写一份竞品分析"),
        metadataLine({ aiTitle: "韩国竞品分析" }),
      ],
      [metadataLine({ aiTitle: "续聊后的新标题" })],
    );
    const info = parseSessionInfoFromLite("web-s_ai", lite);
    assert.ok(info);
    assert.equal(info.aiTitle, "韩国竞品分析");
    assert.equal(info.summary, "韩国竞品分析");
  });

  it("prefers user custom title over aiTitle and first prompt", () => {
    const lite = liteFromLines(
      [
        acceptedInputLine("原始问题"),
        metadataLine({ aiTitle: "AI 标题" }),
      ],
      [metadataLine({ title: "用户重命名" })],
    );
    const info = parseSessionInfoFromLite("web-s_rename", lite);
    assert.ok(info);
    assert.equal(info.customTitle, "用户重命名");
    assert.equal(info.summary, "用户重命名");
  });

  it("skips auto-continue recovery injections when picking first prompt", () => {
    const recovery = [
      "上一段任务因工具失败、信息获取受阻或提前停下而中断。",
      "不要向用户索要「继续」或让用户手动重试。",
      "请先简要分析原因，立即换可行方案（换来源、占位图、已有本地文件等）",
      "完成尚未交付的部分。",
      " 卡住并已跳过的步骤：bash。请改读已知 artifacts/ 或占位继续，结果可能略有偏差。",
    ].join("");
    const lite = liteFromLines(
      [acceptedInputLine("帮我为 Nova Ai-Studio 做品牌广告分镜")],
      [acceptedInputLine(recovery)],
    );
    const info = parseSessionInfoFromLite("web-s_recovery_title", lite);
    assert.ok(info);
    assert.equal(info.firstPrompt, "帮我为 Nova Ai-Studio 做品牌广告分镜");
    assert.equal(info.summary, "帮我为 Nova Ai-Studio 做品牌广告分镜");
  });
});
