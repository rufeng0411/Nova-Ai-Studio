import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isChatFirstCapability,
  userRequestsBrainstormDeliverable,
} from "./chatFirstCapabilities.js";
import { buildCapabilityBindingAppendPrompt } from "./capabilityBindingPrompt.js";

describe("chatFirstCapabilities", () => {
  it("only brainstorming major_category is chat-first", () => {
    assert.equal(isChatFirstCapability("persona-trump", "brainstorming"), true);
    assert.equal(isChatFirstCapability("pms-create-prd", "brainstorming"), true);
    assert.equal(isChatFirstCapability("brainstorm-structured", "brainstorming"), true);
    assert.equal(isChatFirstCapability("hub-pack-pm-toolkit", "brainstorming"), true);
  });

  it("non-brainstorming major never chat-first even with chatty slugs", () => {
    assert.equal(isChatFirstCapability("persona-trump", "marketing"), false);
    assert.equal(isChatFirstCapability("persona-buffett"), false);
    assert.equal(isChatFirstCapability("df-bootstrap", "development"), false);
    assert.equal(isChatFirstCapability("office-ecom", "office"), false);
    assert.equal(isChatFirstCapability("ora-brainstorm-research", "education"), false);
    assert.equal(isChatFirstCapability("mkt-marketing-ideas", "marketing"), false);
    assert.equal(isChatFirstCapability("pd-geo", "marketing"), false);
  });

  it("detects deliverable intent in user text", () => {
    assert.equal(userRequestsBrainstormDeliverable("帮我生成报告"), true);
    assert.equal(userRequestsBrainstormDeliverable("写一份 PRD 到 artifacts"), true);
    assert.equal(userRequestsBrainstormDeliverable("用特朗普思维跟我聊聊"), false);
  });
});

describe("capabilityBindingPrompt chat-first", () => {
  it("brainstorming binding forbids default tool use", () => {
    const prompt = buildCapabilityBindingAppendPrompt({
      slug: "persona-trump",
      displayName: "特朗普思维",
      majorCategory: "brainstorming",
    });
    assert.match(prompt, /脑爆/);
    assert.match(prompt, /须快速回复/);
    assert.match(prompt, /默认禁止调用任何工具/);
    assert.match(prompt, /生成报告、总结分析/);
    assert.doesNotMatch(prompt, /必须先 read_skill/);
  });

  it("non-brainstorming skills still require read_skill", () => {
    const prompt = buildCapabilityBindingAppendPrompt({
      slug: "pd-geo",
      displayName: "AI 搜索全案",
      majorCategory: "marketing",
    });
    assert.match(prompt, /必须先 read_skill/);
  });

  it("persona outside brainstorming tab uses execute binding", () => {
    const prompt = buildCapabilityBindingAppendPrompt({
      slug: "persona-trump",
      displayName: "特朗普思维",
      majorCategory: "marketing",
    });
    assert.match(prompt, /必须先 read_skill/);
  });
});
