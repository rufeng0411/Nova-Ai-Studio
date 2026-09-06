// PD-SAAS-FORK: N2 Bot β HUD copy — follows UI language. Product is N2 Bot; she is Nova.

import { novaLine, type NovaLocale } from '../../../../src/saas/n2Bot/novaPersona';

export function n2Locale(lang?: string): NovaLocale {
  return lang?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function n2Copy(lang?: string) {
  const locale = n2Locale(lang);
  const zh = locale === 'zh-CN';
  return {
    locale,
    product: 'N2 Bot',
    beta: 'β',
    chipLabel: zh ? 'N2 Bot' : 'N2 Bot',
    liveTalk: zh ? '实时对话' : 'Live talk',
    listening: zh ? '正在听，说的话会写进对话' : 'Listening — it goes into this chat',
    online: zh ? '在线' : 'Online',
    speakerOn: zh ? '扬声器开' : 'Speaker on',
    speakerOff: zh ? '扬声器关' : 'Speaker off',
    placeholder: zh ? '说要做的，或先聊一句' : 'Say what to do, or just chat',
    send: zh ? '发送' : 'Send',
    close: zh ? '关闭' : 'Close',
    need: zh ? '需要你' : 'Needs you',
    run: zh ? '进行中' : 'Running',
    queue: zh ? '排队' : 'Queued',
    plan: zh ? '已订点' : 'Planned',
    done: zh ? '已完成' : 'Done',
    liveGroup: zh ? '进行中' : 'Running',
    general: zh ? '通用' : 'General',
    outcomesCount: (n: number) => (zh ? `${n} 项成果` : `${n} result${n === 1 ? '' : 's'}`),
    outcomesNone: zh ? '暂无成果' : 'No results yet',
    opsEmpty: zh ? '手头还没有任务' : 'Nothing on the plate yet',
    pause: zh ? '暂停' : 'Pause',
    resume: zh ? '继续' : 'Resume',
    allowSend: zh ? '允许外发' : 'Allow send',
    hub: zh ? '能力' : 'Skills',
    loginHint: zh ? '请回工作台登录后再打开 N2 Bot。' : 'Sign in on the workbench, then open N2 Bot.',
    wake: novaLine('wake', locale),
    idle: novaLine('idle', locale),
    received: novaLine('received', locale),
    stillHere: novaLine('stillHere', locale),
    shareReady: novaLine('shareReady', locale),
    sendNeedAllow: novaLine('sendNeedAllow', locale),
    sendAllowed: novaLine('sendAllowed', locale),
    stopAll: novaLine('stopAll', locale),
    needFile: novaLine('needFile', locale),
    identity: novaLine('identity', locale),
    thanks: novaLine('thanks', locale),
    deleteAsk: novaLine('deleteAsk', locale),
    deleteBody: novaLine('deleteBody', locale),
    vizOrb: zh ? '光核' : 'Core',
    vizWave: zh ? '折线' : 'Wave',
    opsDegraded: zh ? '手头暂时看不全' : 'Plate is incomplete for now.',
    back: zh ? '返回工作台' : 'Back to workbench',
    save: zh ? '保存到本机' : 'Save locally',
  };
}
