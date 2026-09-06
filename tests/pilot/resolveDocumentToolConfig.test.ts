import test from "node:test";

import assert from "node:assert/strict";



import {

  matchesMineruApiKey,

  resolveBaiduAiConfig,

  resolveDocumentComposeConfig,

  resolveDocumentOcrConfig,

  resolveEditablePptxConfig,

} from "../../src/pilot/config/resolveDocumentToolConfig.js";



const MINERU_JWT =

  "eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiJ0ZXN0In0.signature";



const EMPTY_MODEL = { providers: {} };



test("matchesMineruApiKey accepts JWT and long opaque tokens", () => {

  assert.equal(matchesMineruApiKey(MINERU_JWT), true);

  assert.equal(matchesMineruApiKey("a".repeat(32)), true);

  assert.equal(matchesMineruApiKey("short"), false);

  assert.equal(matchesMineruApiKey("VVqkdSmxfj-YVyyLyqA2d"), false);

});



test("resolveDocumentComposeConfig prefers explicit aspect ratio then env", () => {

  const fromExplicit = resolveDocumentComposeConfig({ aspectRatio: "4:3" });

  assert.equal(fromExplicit.aspectRatio, "4:3");



  const fromEnv = resolveDocumentComposeConfig(undefined, {

    PILOTDECK_DOCUMENT_COMPOSE_ASPECT_RATIO: "1:1",

  });

  assert.equal(fromEnv.aspectRatio, "1:1");



  const fallback = resolveDocumentComposeConfig(undefined, {});

  assert.equal(fallback.aspectRatio, "16:9");

});



test("resolveDocumentOcrConfig resolves MinerU JWT from explicit config", () => {

  const resolved = resolveDocumentOcrConfig(

    {

      provider: "mineru",

      mode: "cloud",

      apiKey: MINERU_JWT,

      fallbackProvider: "qwen-vl",

    },

    {},

    {},

  );

  assert.ok(resolved);

  assert.equal(resolved?.provider, "mineru");

  assert.equal(resolved?.apiKey, MINERU_JWT);

  assert.equal(resolved?.apiUrl, "https://mineru.net/api/v4");

  assert.equal(resolved?.extractorMethod, "hybrid");

  assert.equal(resolved?.inpaintMethod, "baidu");

});



test("resolveBaiduAiConfig treats bce-v3 api key as configured without secret", () => {

  const baidu = resolveBaiduAiConfig({

    apiKey: "bce-v3/ALTAK-test-key/abcdef",

  });

  assert.equal(baidu.configured, true);

});



test("resolveBaiduAiConfig inherits api key + secret for hybrid readiness", () => {

  const baidu = resolveBaiduAiConfig({ apiKey: "bk-test", secretKey: "sk-test" });

  assert.equal(baidu.configured, true);



  const editable = resolveEditablePptxConfig(

    {

      documentOcr: { provider: "mineru", mode: "cloud", apiKey: MINERU_JWT, extractorMethod: "hybrid" },

      baiduAi: { apiKey: "bk-test", secretKey: "sk-test" },

    },

    EMPTY_MODEL,

    {},

  );

  assert.ok(editable?.hybridReady);



  const mineruOnly = resolveEditablePptxConfig(

    {

      documentOcr: { provider: "mineru", mode: "cloud", apiKey: MINERU_JWT, extractorMethod: "mineru" },

    },

    EMPTY_MODEL,

    {},

  );

  assert.ok(mineruOnly?.hybridReady);

});



test("resolveEditablePptxConfig hybrid not ready without Baidu keys", () => {

  const editable = resolveEditablePptxConfig(

    {

      documentOcr: { provider: "mineru", mode: "cloud", apiKey: MINERU_JWT, extractorMethod: "hybrid" },

    },

    EMPTY_MODEL,

    {},

  );

  assert.ok(editable);

  assert.equal(editable?.hybridReady, false);

});



test("resolveDocumentOcrConfig falls back to qwen-vl when MinerU key missing but DashScope present", () => {

  const resolved = resolveDocumentOcrConfig(

    { provider: "mineru", mode: "cloud", fallbackProvider: "qwen-vl" },

    { qwen: { apiKey: "sk-test-dashscope-key-1234567890" } },

    {},

  );

  assert.ok(resolved);

  assert.equal(resolved?.provider, "qwen-vl");

  assert.equal(resolved?.dashscopeApiKey, "sk-test-dashscope-key-1234567890");

});



test("resolveDocumentOcrConfig returns undefined when neither MinerU nor DashScope configured", () => {

  const resolved = resolveDocumentOcrConfig(

    { provider: "mineru", mode: "cloud", fallbackProvider: "qwen-vl" },

    {},

    {},

  );

  assert.equal(resolved, undefined);

});



test("resolveDocumentOcrConfig reads MINERU_API_TOKEN from env", () => {

  const resolved = resolveDocumentOcrConfig(

    { provider: "mineru", mode: "cloud" },

    {},

    { MINERU_API_TOKEN: MINERU_JWT },

  );

  assert.ok(resolved);

  assert.equal(resolved?.apiKey, MINERU_JWT);

});

