/**
 * Curated model catalog merged after remote list-models fetch.
 * Many DashScope / Ark models are not returned by GET /models (image, video, TTS use other APIs).
 *
 * kinds: chat | vl | image | video | tts | speech
 */

/** @type {Record<string, Array<{ id: string, label: string, kinds: string[] }>>} */
export const MODEL_SUPPLEMENTS = {
  qwen: [
    // ── 千问 3.8 对话（百炼 Token Plan 预览）──
    { id: 'qwen3.8-max-preview', label: '千问 3.8 Max Preview（Token Plan）', kinds: ['chat', 'vl'] },
    // ── 千问 3.6 / 3.7 对话 ──
    { id: 'qwen3.7-max', label: '千问 3.7 Max', kinds: ['chat'] },
    { id: 'qwen3.7-max-preview', label: '千问 3.7 Max Preview', kinds: ['chat'] },
    { id: 'qwen3.7-max-2026-05-17', label: '千问 3.7 Max（2026-05-17）', kinds: ['chat'] },
    { id: 'qwen3.7-max-2026-05-20', label: '千问 3.7 Max（2026-05-20）', kinds: ['chat'] },
    { id: 'qwen3.7-max-2026-06-08', label: '千问 3.7 Max（2026-06-08，免费额度）', kinds: ['chat'] },
    { id: 'qwen3.7-plus', label: '千问 3.7 Plus（免费额度）', kinds: ['chat', 'vl'] },
    { id: 'qwen3.7-plus-2026-05-26', label: '千问 3.7 Plus（2026-05-26，免费额度）', kinds: ['chat', 'vl'] },
    { id: 'qwen3.7-flash', label: '千问 3.7 Flash', kinds: ['chat'] },
    { id: 'qwen3.7-flash-2026-07-15', label: '千问 3.7 Flash（2026-07-15）', kinds: ['chat'] },
    { id: 'qwen3.5-ocr', label: '千问 3.5 OCR（识图/OCR，免费额度）', kinds: ['vl', 'chat'] },
    { id: 'glm-5.2', label: 'GLM 5.2（百炼托管，免费额度）', kinds: ['chat'] },
    { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code（百炼托管，免费额度）', kinds: ['chat'] },
    { id: 'kimi-k2.6', label: 'Kimi K2.6（百炼托管）', kinds: ['chat', 'vl'] },
    { id: 'kimi-k2.5', label: 'Kimi K2.5（百炼托管）', kinds: ['chat'] },
    // ── DeepSeek（百炼直供 / 硅基流动接入）──
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（百炼）', kinds: ['chat'] },
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（百炼）', kinds: ['chat'] },
    { id: 'deepseek-v3.2', label: 'DeepSeek V3.2（百炼）', kinds: ['chat'] },
    { id: 'deepseek-v3.1', label: 'DeepSeek V3.1（百炼）', kinds: ['chat'] },
    { id: 'deepseek-r1', label: 'DeepSeek R1（百炼）', kinds: ['chat'] },
    { id: 'deepseek-r1-0528', label: 'DeepSeek R1 0528（百炼）', kinds: ['chat'] },
    { id: 'deepseek-v3', label: 'DeepSeek V3（百炼）', kinds: ['chat'] },
    { id: 'siliconflow/deepseek-v3.2', label: 'DeepSeek V3.2（硅基流动）', kinds: ['chat'] },
    { id: 'siliconflow/deepseek-v3.1-terminus', label: 'DeepSeek V3.1 Terminus（硅基流动）', kinds: ['chat'] },
    { id: 'siliconflow/deepseek-r1-0528', label: 'DeepSeek R1 0528（硅基流动）', kinds: ['chat'] },
    { id: 'siliconflow/deepseek-v3-0324', label: 'DeepSeek V3 0324（硅基流动）', kinds: ['chat'] },
    { id: 'qwen3.6-max-preview', label: '千问 3.6 Max Preview', kinds: ['chat'] },
    { id: 'qwen3.6-plus', label: '千问 3.6 Plus', kinds: ['chat'] },
    { id: 'qwen3.6-plus-2026-04-02', label: '千问 3.6 Plus（快照）', kinds: ['chat'] },
    { id: 'qwen3.6-flash', label: '千问 3.6 Flash', kinds: ['chat'] },
    { id: 'qwen3.6-flash-2026-04-16', label: '千问 3.6 Flash（快照）', kinds: ['chat'] },
    { id: 'qwen3.6-35b-a3b', label: '千问 3.6 35B A3B', kinds: ['chat'] },
    { id: 'qwen3-max', label: '千问 3 Max', kinds: ['chat'] },
    { id: 'qwen3-max-preview', label: '千问 3 Max Preview', kinds: ['chat'] },
    { id: 'qwen-max', label: '千问 Max', kinds: ['chat'] },
    { id: 'qwen-max-latest', label: '千问 Max Latest', kinds: ['chat'] },
    { id: 'qwen-plus', label: '千问 Plus', kinds: ['chat'] },
    { id: 'qwen-plus-latest', label: '千问 Plus Latest', kinds: ['chat'] },
    { id: 'qwen-flash', label: '千问 Flash', kinds: ['chat'] },
    { id: 'qwen-turbo', label: '千问 Turbo', kinds: ['chat'] },
    { id: 'qwen-turbo-latest', label: '千问 Turbo Latest', kinds: ['chat'] },
    { id: 'qwen-long', label: '千问 Long（超长上下文）', kinds: ['chat'] },
    { id: 'qwen3.5-plus', label: '千问 3.5 Plus', kinds: ['chat'] },
    { id: 'qwen3.5-flash', label: '千问 3.5 Flash', kinds: ['chat'] },
    { id: 'qwen3-235b-a22b', label: '千问 3 235B', kinds: ['chat'] },
    { id: 'qwen3-32b', label: '千问 3 32B', kinds: ['chat'] },
    { id: 'qwen3-30b-a3b', label: '千问 3 30B A3B', kinds: ['chat'] },
    { id: 'qwen2.5-72b-instruct', label: '千问 2.5 72B', kinds: ['chat'] },
    { id: 'qwen2.5-32b-instruct', label: '千问 2.5 32B', kinds: ['chat'] },
    { id: 'qwen2.5-14b-instruct', label: '千问 2.5 14B', kinds: ['chat'] },
    { id: 'qwen2.5-7b-instruct', label: '千问 2.5 7B', kinds: ['chat'] },
    { id: 'qwq-plus', label: 'QwQ Plus（推理）', kinds: ['chat'] },
    { id: 'qwq-32b', label: 'QwQ 32B', kinds: ['chat'] },
    { id: 'qwen3-coder-plus', label: '千问 Coder Plus', kinds: ['chat'] },
    { id: 'qwen3-coder-flash', label: '千问 Coder Flash', kinds: ['chat'] },
    // ── 视觉对话 ──
    { id: 'qwen-vl-max', label: '千问 VL Max（识图对话）', kinds: ['vl', 'chat'] },
    { id: 'qwen-vl-max-latest', label: '千问 VL Max Latest', kinds: ['vl', 'chat'] },
    { id: 'qwen-vl-plus', label: '千问 VL Plus（识图对话）', kinds: ['vl', 'chat'] },
    { id: 'qwen-vl-plus-latest', label: '千问 VL Plus Latest', kinds: ['vl', 'chat'] },
    { id: 'qwen3-vl-plus', label: '千问 3 VL Plus', kinds: ['vl', 'chat'] },
    // ── 图片生成 / 编辑（通义万相 / Qwen Image）──
    { id: 'qwen-image-3.0-pro', label: 'Qwen Image 3.0 Pro（文生图/图生图）', kinds: ['image'] },
    { id: 'qwen-image-2.0-pro', label: '通义万相 图片 2.0 Pro', kinds: ['image'] },
    { id: 'qwen-image-2.0', label: '通义万相 图片 2.0', kinds: ['image'] },
    { id: 'qwen-image-plus', label: '通义万相 图片 Plus', kinds: ['image'] },
    { id: 'qwen-image-plus-2026-01-09', label: '通义万相 图片 Plus（快照）', kinds: ['image'] },
    { id: 'qwen-image-max', label: '通义万相 图片 Max', kinds: ['image'] },
    { id: 'qwen-image-max-2025-12-30', label: '通义万相 图片 Max（快照）', kinds: ['image'] },
    { id: 'qwen-image-edit-plus', label: '通义万相 图片编辑 Plus', kinds: ['image'] },
    { id: 'qwen-image-edit-max', label: '通义万相 图片编辑 Max', kinds: ['image'] },
    { id: 'qwen-image-edit', label: '通义万相 图片编辑', kinds: ['image'] },
    { id: 'qwen-image-2-edit', label: '通义万相 图片 2 编辑', kinds: ['image'] },
    { id: 'wanx2.1-t2i-turbo', label: '万相 2.1 文生图 Turbo', kinds: ['image'] },
    { id: 'wanx2.1-t2i-plus', label: '万相 2.1 文生图 Plus', kinds: ['image'] },
    { id: 'wanx-v1', label: '万相 V1 文生图', kinds: ['image'] },
    // ── 视频（含 Happy Horse）──
    { id: 'wanx2.1-t2v-turbo', label: '万相 2.1 文生视频 Turbo', kinds: ['video'] },
    { id: 'wanx2.1-i2v-turbo', label: '万相 2.1 图生视频 Turbo', kinds: ['video'] },
    { id: 'wanx2.1-i2v-plus', label: '万相 2.1 图生视频 Plus', kinds: ['video'] },
    { id: 'happyhorse-1.0', label: 'Happy Horse 1.0（图生视频）', kinds: ['video'] },
    { id: 'happyhorse-1.0-t2v', label: 'Happy Horse 1.0 文生视频', kinds: ['video'] },
    { id: 'happyhorse-1.0-i2v', label: 'Happy Horse 1.0 图生视频', kinds: ['video'] },
    { id: 'happyhorse-1.0-r2v', label: 'Happy Horse 1.0 参考图生视频', kinds: ['video'] },
    // ── 语音合成 TTS ──
    { id: 'qwen-tts-realtime', label: '千问 TTS 实时', kinds: ['tts'] },
    { id: 'qwen-tts-realtime-latest', label: '千问 TTS 实时 Latest', kinds: ['tts'] },
    { id: 'qwen-tts-realtime-2025-07-15', label: '千问 TTS 实时（快照）', kinds: ['tts'] },
    { id: 'cosyvoice-v3.5-plus', label: 'CosyVoice 3.5 Plus（语音合成）', kinds: ['tts'] },
    { id: 'cosyvoice-v3.5-flash', label: 'CosyVoice 3.5 Flash（语音合成）', kinds: ['tts'] },
    { id: 'cosyvoice-v3-plus', label: 'CosyVoice 3 Plus（语音合成）', kinds: ['tts'] },
    { id: 'cosyvoice-v3-flash', label: 'CosyVoice 3 Flash（语音合成）', kinds: ['tts'] },
    { id: 'cosyvoice-v2', label: 'CosyVoice V2（语音合成）', kinds: ['tts'] },
    { id: 'qwen3-tts-flash', label: 'Qwen3 TTS Flash（多语种）', kinds: ['tts'] },
    { id: 'qwen3-tts-flash-realtime', label: 'Qwen3 TTS Flash Realtime', kinds: ['tts'] },
    { id: 'qwen3-tts-instruct-flash', label: 'Qwen3 TTS Instruct Flash', kinds: ['tts'] },
    { id: 'qwen3-tts-instruct-flash-realtime', label: 'Qwen3 TTS Instruct Realtime', kinds: ['tts'] },
    { id: 'qwen3-tts-vc-2026-01-22', label: 'Qwen3 TTS 声音复刻', kinds: ['tts'] },
    { id: 'qwen3-tts-vd-2026-01-26', label: 'Qwen3 TTS 声音设计', kinds: ['tts'] },
    { id: 'sambert-zhichu-v1', label: 'Sambert 知厨（旧版 TTS）', kinds: ['tts'] },
    // ── 语音识别 ASR ──
    { id: 'paraformer-realtime-v2', label: 'Paraformer 实时语音识别', kinds: ['speech'] },
    { id: 'paraformer-v2', label: 'Paraformer V2 语音识别', kinds: ['speech'] },
    { id: 'fun-asr-realtime', label: 'Fun-ASR 实时识别', kinds: ['speech'] },
    { id: 'fun-asr', label: 'Fun-ASR 语音识别', kinds: ['speech'] },
    { id: 'fun-asr-realtime-2025-11-07', label: 'Fun-ASR Realtime（2025-11）', kinds: ['speech'] },
    { id: 'fun-asr-2025-11-07', label: 'Fun-ASR 文件（2025-11）', kinds: ['speech'] },
    { id: 'fun-asr-flash-2026-06-15', label: 'Fun-ASR Flash 短音频', kinds: ['speech'] },
    { id: 'qwen3-asr-flash-realtime', label: 'Qwen3 ASR Realtime', kinds: ['speech'] },
    { id: 'qwen3-asr-flash-filetrans', label: 'Qwen3 ASR 文件转写', kinds: ['speech'] },
    { id: 'voice-enrollment', label: '音色注册（CosyVoice 复刻）', kinds: ['tts'] },
  ],
  volcengine: [
    // ── 对话 Seed ──
    { id: 'doubao-seed-1-8-251228', label: '豆包 Seed 1.8', kinds: ['chat'] },
    { id: 'doubao-seed-1-6-251015', label: '豆包 Seed 1.6', kinds: ['chat'] },
    { id: 'doubao-seed-1-6-flash', label: '豆包 Seed 1.6 Flash', kinds: ['chat'] },
    { id: 'doubao-seed-1-6-lite', label: '豆包 Seed 1.6 Lite', kinds: ['chat'] },
    { id: 'doubao-seed-1-6-thinking', label: '豆包 Seed 1.6 Thinking', kinds: ['chat'] },
    { id: 'doubao-1.5-pro-256k', label: '豆包 1.5 Pro 256K', kinds: ['chat'] },
    { id: 'doubao-1.5-pro-32k', label: '豆包 1.5 Pro 32K', kinds: ['chat'] },
    { id: 'doubao-1.5-pro', label: '豆包 1.5 Pro', kinds: ['chat'] },
    { id: 'doubao-1.5-lite-128k', label: '豆包 1.5 Lite 128K', kinds: ['chat'] },
    { id: 'doubao-1.5-lite-32k', label: '豆包 1.5 Lite 32K', kinds: ['chat'] },
    { id: 'doubao-1.5-lite', label: '豆包 1.5 Lite', kinds: ['chat'] },
    { id: 'doubao-1.5-vision-pro-32k', label: '豆包 1.5 Vision Pro', kinds: ['vl', 'chat'] },
    { id: 'doubao-1.5-vision-lite-32k', label: '豆包 1.5 Vision Lite', kinds: ['vl', 'chat'] },
    { id: 'doubao-seed-code-preview-latest', label: '豆包 Seed Code', kinds: ['chat'] },
    { id: 'deepseek-r1', label: 'DeepSeek R1（火山）', kinds: ['chat'] },
    { id: 'deepseek-v3', label: 'DeepSeek V3（火山）', kinds: ['chat'] },
    // ── Seedream 图片 ──
    { id: 'doubao-seedream-4-5-251128', label: 'Seedream 4.5', kinds: ['image'] },
    { id: 'doubao-seedream-4-0-250828', label: 'Seedream 4.0', kinds: ['image'] },
    { id: 'doubao-seedream-3-0-t2i-250415', label: 'Seedream 3.0 文生图', kinds: ['image'] },
    { id: 'doubao-seedream-5-0-lite', label: 'Seedream 5.0 Lite', kinds: ['image'] },
    { id: 'high_aes_general_v30l_zt2i', label: '通用 3.0 高清文生图', kinds: ['image'] },
    { id: 'jimeng_t2i_v30', label: '即梦 3.0 文生图', kinds: ['image'] },
    { id: 'jimeng_t2i_v31', label: '即梦 3.1 文生图', kinds: ['image'] },
    // ── Seedance 视频 ──
    { id: 'Doubao-Seedance-2.0', label: 'Seedance 2.0', kinds: ['video'] },
    { id: 'doubao-seedance-1-5-pro-251215', label: 'Seedance 1.5 Pro（有声）', kinds: ['video'] },
    { id: 'doubao-seedance-1-0-pro-250528', label: 'Seedance 1.0 Pro', kinds: ['video'] },
    { id: 'doubao-seedance-1-0-pro-fast-250610', label: 'Seedance 1.0 Pro Fast', kinds: ['video'] },
    { id: 'doubao-seedance-1-0-lite-t2v-250428', label: 'Seedance 1.0 Lite 文生视频', kinds: ['video'] },
    { id: 'doubao-seedance-1-0-lite-i2v-250428', label: 'Seedance 1.0 Lite 图生视频', kinds: ['video'] },
  ],
  google: [
    // ── Gemini 3.x / 2.5 对话 ──
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', kinds: ['chat'] },
    { id: 'gemini-3.1-pro-preview-customtools', label: 'Gemini 3.1 Pro Preview（Custom Tools）', kinds: ['chat'] },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', kinds: ['chat'] },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', kinds: ['chat'] },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview', kinds: ['chat'] },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', kinds: ['chat'] },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', kinds: ['chat'] },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', kinds: ['chat'] },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', kinds: ['chat'] },
    { id: 'gemini-flash-latest', label: 'Gemini Flash Latest', kinds: ['chat'] },
    { id: 'gemini-pro-latest', label: 'Gemini Pro Latest', kinds: ['chat'] },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', kinds: ['chat'] },
    // ── 图片（Imagen / Gemini Image；常不在 GET /models）──
    { id: 'imagen-4.0-generate-001', label: 'Imagen 4', kinds: ['image'] },
    { id: 'imagen-3.0-generate-002', label: 'Imagen 3', kinds: ['image'] },
    { id: 'imagen-3.0-fast-generate-001', label: 'Imagen 3 Fast', kinds: ['image'] },
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', kinds: ['image'] },
    { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', kinds: ['image'] },
    { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image', kinds: ['image'] },
    { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', kinds: ['image'] },
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', kinds: ['image'] },
    { id: 'nano-banana-pro-preview', label: 'Nano Banana Pro（图片）', kinds: ['image'] },
    // ── 视频（Veo）──
    { id: 'veo-3.0-generate-preview', label: 'Veo 3 Preview', kinds: ['video'] },
    { id: 'veo-2.0-generate-001', label: 'Veo 2', kinds: ['video'] },
    // ── 语音合成 ──
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', kinds: ['tts'] },
    { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', kinds: ['tts'] },
    { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS Preview', kinds: ['tts'] },
  ],
  zhipu: [
    { id: 'glm-4.6', label: 'GLM-4.6', kinds: ['chat', 'vl'] },
    { id: 'glm-4.5', label: 'GLM-4.5', kinds: ['chat', 'vl'] },
    { id: 'glm-4.5-air', label: 'GLM-4.5 Air', kinds: ['chat'] },
    { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash', kinds: ['chat'] },
    { id: 'glm-4-flash', label: 'GLM-4 Flash', kinds: ['chat'] },
    { id: 'glm-4-plus', label: 'GLM-4 Plus', kinds: ['chat'] },
    { id: 'glm-4.6v', label: 'GLM-4.6V（识图）', kinds: ['vl', 'chat'] },
    { id: 'glm-4.5v', label: 'GLM-4.5V（识图）', kinds: ['vl', 'chat'] },
  ],
  kimi: [
    { id: 'kimi-k2.6', label: 'Kimi K2.6', kinds: ['chat', 'vl'] },
    { id: 'kimi-k2.5', label: 'Kimi K2.5', kinds: ['chat'] },
    { id: 'kimi-k1.5', label: 'Kimi K1.5', kinds: ['chat', 'vl'] },
  ],
};

const KIND_LABELS = {
  chat: '对话',
  vl: '识图对话',
  image: '图片',
  video: '视频',
  tts: '语音合成',
  speech: '语音识别',
};

export function inferModelKind(modelId) {
  const id = String(modelId || '').toLowerCase();
  if (/^imagen-|imagen-|nano-banana|gemini-.*-image|flash-image|image-generation/.test(id)) return 'image';
  if (/^veo-|veo-|lyria-/.test(id)) return 'video';
  if (/seedream|qwen-image|wanx|t2i|image-edit|jimeng_t2i|high_aes/.test(id)) return 'image';
  if (/seedance|happyhorse|t2v|i2v|text-to-video|image-to-video/.test(id)) return 'video';
  if (/gemini-.*-tts|preview-tts|multimodalembedding/.test(id)) return 'tts';
  if (/cosyvoice|sambert|qwen-tts|qwen3-tts|voice-enrollment/.test(id)) return 'tts';
  if (/paraformer|fun-asr|qwen3-asr|asr|speech/.test(id)) return 'speech';
  if (/qwen-vl|qwen3\.5-ocr|vision|vl-/.test(id)) return 'vl';
  if (/kimi-k2.*code|coder/.test(id)) return 'chat';
  if (/^kimi-/.test(id)) return 'chat';
  if (/^deepseek-|^siliconflow\/deepseek-/.test(id)) return 'chat';
  if (/^glm-/.test(id)) return 'chat';
  return 'chat';
}

export function formatModelKindLabel(kind) {
  return KIND_LABELS[kind] || kind;
}

/**
 * @param {string} providerKey
 * @param {{ kinds?: string[] }} [options]
 */
export function supplementsAsModels(providerKey, options = {}) {
  const entries = MODEL_SUPPLEMENTS[providerKey] ?? [];
  const kinds = Array.isArray(options.kinds) ? options.kinds : undefined;
  const filtered = kinds?.length
    ? entries.filter((entry) => entry.kinds.some((kind) => kinds.includes(kind)))
    : entries;
  return filtered.map((entry) => ({
    id: entry.id,
    label: entry.label,
    kinds: entry.kinds,
  }));
}

export function annotateModelsWithKinds(models) {
  return models.map((entry) => {
    const id = String(entry?.id || '').trim();
    const kinds = Array.isArray(entry?.kinds) && entry.kinds.length > 0
      ? entry.kinds
      : [inferModelKind(id)];
    return {
      ...entry,
      id,
      label: entry?.label || id,
      kinds,
    };
  });
}

export function filterModelsByKinds(models, kinds) {
  if (!kinds?.length) return models;
  return models.filter((entry) => entry.kinds?.some((kind) => kinds.includes(kind)));
}
