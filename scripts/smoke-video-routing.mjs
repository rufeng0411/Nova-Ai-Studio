#!/usr/bin/env node
/**
 * Unit-style smoke for media video routing (no live gateway required).
 */
import { resolveMediaStrategy } from '../src/saas/media/mediaStrategyResolver.ts';

const envReady = {
  DASHSCOPE_API_KEY: 'sk-test',
  PILOTDECK_VIDEO_MODEL: 'happyhorse-1.0-t2v',
  PILOTDECK_TTS_API_KEY: 'sk-test',
  PILOTDECK_SPEECH_API_KEY: 'sk-test',
};

process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER = '1';

const cases = [
  {
    name: 'mp4 goal with video api',
    goal: '生成 15 秒产品宣传 mp4 成片',
    env: envReady,
    expect: 'generate_video',
  },
  {
    name: 'remotion explicit',
    goal: '用 Remotion 做可编辑时间轴工程',
    env: envReady,
    expect: 'render_html_video',
  },
  {
    name: 'tts goal',
    goal: '把这段文案配中文旁白 mp3',
    env: envReady,
    expect: 'generate_speech',
  },
  {
    name: 'transcribe goal',
    goal: '转写 meeting.mp3 会议纪要',
    env: envReady,
    expect: 'transcribe_audio',
  },
];

let failed = 0;
for (const c of cases) {
  const got = resolveMediaStrategy(c.goal, undefined, c.env);
  if (got !== c.expect) {
    console.error(`FAIL ${c.name}: expected ${c.expect}, got ${got}`);
    failed += 1;
  } else {
    console.log(`OK ${c.name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log('smoke:video-routing passed');
