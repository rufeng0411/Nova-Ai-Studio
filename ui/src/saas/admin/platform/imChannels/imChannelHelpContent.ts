/**
 * PD-SAAS-FORK: 消息通道图文帮助文案（企微 / 钉钉 / WhatsApp）
 */
import type { ImBrandId } from './ImChannelBrandIcon';

export type ImHelpMode = 'notify' | 'chat';

export type ImHelpStep = {
  title: string;
  body: string;
  /** 可选：界面示意标签（用于线框卡片） */
  uiHint?: string;
  tip?: string;
};

export type ImHelpGuide = {
  brand: ImBrandId;
  title: string;
  subtitle: string;
  /** 官方文档（外链，新窗口） */
  officialUrl?: string;
  officialLabel?: string;
  overview: string;
  steps: ImHelpStep[];
  /** 字段对照：官方概念 → 本系统填写项 */
  fieldMap: Array<{ official: string; nova: string; note?: string }>;
  checklist: string[];
  warnings: string[];
};

const GUIDES: Record<ImBrandId, Record<ImHelpMode, ImHelpGuide>> = {
  wecom: {
    notify: {
      brand: 'wecom',
      title: '企业微信 · 出站通知',
      subtitle: '创建群机器人 → 复制 Webhook → 填入本系统',
      officialUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
      officialLabel: '企微群机器人官方说明',
      overview:
        '出站通知用于让 Agent 向指定企业微信群推送一条文字（任务完成、告警等），不是群内双向聊天。',
      steps: [
        {
          title: '打开目标群聊',
          body: '在企业微信（PC 或手机）进入要接收通知的内部群。',
          uiHint: '企业微信 → 群聊',
        },
        {
          title: '添加群机器人',
          body: '群设置 → 群机器人 → 添加机器人 → 新建机器人，填写名称（如「Nova 通知」）并创建。',
          uiHint: '群设置 → 群机器人 → 添加',
          tip: '需具备群管理权限；外部群/部分受限群可能无法添加机器人。',
        },
        {
          title: '复制 Webhook 地址',
          body: '创建成功后页面会显示 Webhook URL（形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…）。完整复制，勿截断。',
          uiHint: '复制 Webhook',
        },
        {
          title: '填入本系统并保存',
          body: '回到后台「消息通道 → 出站通知 → 企业微信」，粘贴到「群机器人 Webhook URL」，点击「保存出站通知」。',
          uiHint: '后台 → 消息通道',
        },
        {
          title: '验证（可选）',
          body: '平台 flag 允许且 Hub/对话中启用通知能力后，可让 Agent 发一条测试文案到该群。保存后若工具未出现，请重启 Gateway。',
        },
      ],
      fieldMap: [
        { official: 'Webhook URL', nova: '群机器人 Webhook URL', note: '写入 mcp.json → im-notify' },
      ],
      checklist: [
        'Webhook 以 https://qyapi.weixin.qq.com 开头且含 key=',
        '本系统已保存且状态显示「已配置」',
        '测试消息能出现在正确群',
      ],
      warnings: [
        'Webhook 等同群发言权限，勿提交到代码仓库或发给无关人员',
        '出站通知不会开启 App 对话长连接',
      ],
    },
    chat: {
      brand: 'wecom',
      title: '企业微信 · App 对话',
      subtitle: '创建智能机器人应用 → 取得 Bot ID / Secret → 在本系统启用',
      officialUrl: 'https://developer.work.weixin.qq.com/document/path/99499',
      officialLabel: '企微智能机器人相关文档',
      overview:
        'App 对话让员工在企业微信里与 Nova Agent 双向聊天。需企业管理员创建应用/机器人并拿到 Bot ID（token）与 Secret；平台 flag PILOTDECK_IM_CHANNELS 允许后才可启用。',
      steps: [
        {
          title: '进入企业管理后台',
          body: '使用企业管理员账号登录 work.weixin.qq.com 管理后台。',
          uiHint: 'work.weixin.qq.com',
        },
        {
          title: '创建/配置智能机器人应用',
          body: '按企业现网规范创建可与外部系统对接的智能机器人（或 AI 应用），完成可见范围与权限配置。',
          uiHint: '应用管理 → 智能机器人',
          tip: '不同企微版本菜单名称可能略有差异，以管理后台实际入口为准。',
        },
        {
          title: '获取 Bot ID 与 Secret',
          body: '在应用凭证页复制 Bot ID（本系统表单中的 token）与 Secret，妥善保管。',
          uiHint: '凭证页 → 复制',
        },
        {
          title: '填入本系统',
          body: '后台「消息通道 → App 对话 → 企业微信」填写 Bot ID、Secret，先点「保存凭证」。',
          uiHint: '后台 → App 对话',
        },
        {
          title: '启用对话（二次确认）',
          body: '确认平台已开放 IM 通道后，打开「启用对话」并确认。Gateway 将建立连接；异常时查看 Gateway 日志并视情况重启。',
        },
      ],
      fieldMap: [
        { official: 'Bot ID / 机器人 ID', nova: 'Bot ID（token）' },
        { official: 'Secret', nova: 'Secret' },
      ],
      checklist: [
        '凭证已保存（可显示「已配置」）',
        '平台 PILOTDECK_IM_CHANNELS 非 off',
        '启用后可在企微侧收到 Agent 回复',
      ],
      warnings: [
        '启用会产生长连接与资源占用，非必要勿对生产全员开启',
        '密钥勿入库；轮换 Secret 后须在本系统更新',
      ],
    },
  },
  dingtalk: {
    notify: {
      brand: 'dingtalk',
      title: '钉钉 · 出站通知',
      subtitle: '群自定义机器人 → Webhook（可选加签）→ 填入本系统',
      officialUrl: 'https://open.dingtalk.com/document/orgapp/custom-robot-access',
      officialLabel: '钉钉自定义机器人文档',
      overview:
        '通过钉钉群「自定义机器人」Webhook，让 Agent 向群内推送一条文字通知。',
      steps: [
        {
          title: '打开钉钉群设置',
          body: '进入目标内部群 → 群设置 → 机器人。',
          uiHint: '钉钉群 → 群设置 → 机器人',
        },
        {
          title: '添加自定义机器人',
          body: '添加机器人 → 自定义（通过 Webhook 接入）→ 设置名称与安全设置。',
          uiHint: '添加 → 自定义',
          tip: '推荐开启「加签」；若启用加签，请同时保存密钥到本系统。',
        },
        {
          title: '复制 Webhook 与加签密钥',
          body: '创建完成后复制 Webhook 地址；若选择加签，再复制 SEC 开头的密钥。',
          uiHint: '复制 Webhook / SEC',
        },
        {
          title: '填入本系统并保存',
          body: '后台「出站通知 → 钉钉」粘贴 Webhook，可选填写加签密钥，保存出站通知。',
          uiHint: '后台 → 消息通道',
        },
      ],
      fieldMap: [
        { official: 'Webhook', nova: '自定义机器人 Webhook URL' },
        { official: '加签密钥 SEC…', nova: '加签密钥（可选）', note: '开启加签时必填' },
      ],
      checklist: [
        'Webhook 可访问且群内能收到机器人消息',
        '若开了加签，密钥与钉钉后台一致',
        '本系统状态为「已配置」',
      ],
      warnings: [
        'Webhook + 加签密钥等同群发言权，勿泄露',
        '关键词安全模式下，发送正文需包含设定关键词（本系统按纯文本发送）',
      ],
    },
    chat: {
      brand: 'dingtalk',
      title: '钉钉 · App 对话',
      subtitle: '创建企业内部应用 → Client ID / Secret → 本系统启用',
      officialUrl: 'https://open.dingtalk.com/document/',
      officialLabel: '钉钉开放平台',
      overview:
        '在钉钉开放平台创建可接收消息的企业内部应用，将 Client ID / Client Secret 配入本系统后，员工可在钉钉与 Agent 双向对话。',
      steps: [
        {
          title: '登录钉钉开放平台',
          body: '使用企业管理员打开 open.dingtalk.com，进入应用开发。',
          uiHint: 'open.dingtalk.com',
        },
        {
          title: '创建企业内部应用',
          body: '创建应用并开通机器人/消息相关能力，配置回调与权限（按现网规范）。',
          uiHint: '应用开发 → 企业内部应用',
        },
        {
          title: '复制 Client ID / Client Secret',
          body: '在应用凭证页获取 Client ID 与 Client Secret。',
          uiHint: '凭证与基础信息',
        },
        {
          title: '填入本系统并启用',
          body: '后台「App 对话 → 钉钉」填写后先保存凭证，再在平台允许时启用对话。',
          uiHint: '后台 → App 对话',
        },
      ],
      fieldMap: [
        { official: 'Client ID / AppKey', nova: 'Client ID' },
        { official: 'Client Secret / AppSecret', nova: 'Client Secret' },
      ],
      checklist: [
        '应用已发布/对目标员工可见',
        '凭证已保存',
        '启用后钉钉侧可对话',
      ],
      warnings: [
        '启用前确认 PILOTDECK_IM_CHANNELS 已开放',
        '勿将 Client Secret 提交到仓库',
      ],
    },
  },
  whatsapp: {
    notify: {
      brand: 'whatsapp',
      title: 'WhatsApp · 出站通知（Cloud API）',
      subtitle: 'Meta 商业帐户 → 永久/系统用户 Token → 填入本系统',
      officialUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
      officialLabel: 'WhatsApp Cloud API 入门',
      overview:
        '使用 Meta WhatsApp Cloud API 向指定号码发送纯文本通知。受 24 小时会话窗口等官方策略限制；不支持 Markdown。',
      steps: [
        {
          title: '准备 Meta 商业资源',
          body: '在 Meta for Developers 创建/关联 Business、WhatsApp 产品，并添加测试或正式号码。',
          uiHint: 'developers.facebook.com',
        },
        {
          title: '获取 Access Token',
          body: '生成具备 whatsapp_business_messaging 等权限的系统用户或长期 Token。',
          uiHint: '系统用户 → 生成令牌',
          tip: '临时调试 Token 易过期，生产请用系统用户长期令牌。',
        },
        {
          title: '记下 Phone Number ID',
          body: '在 WhatsApp → API 设置中复制 Phone number ID（不是显示用的号码本身）。',
          uiHint: 'API 设置 → Phone number ID',
        },
        {
          title: '填入本系统',
          body: '后台「出站通知 → WhatsApp」填写 Access Token、Phone Number ID、默认接收号码（E.164，如 +86138…），保存。',
          uiHint: '后台 → 消息通道',
        },
      ],
      fieldMap: [
        { official: 'Access Token', nova: 'Access Token' },
        { official: 'Phone number ID', nova: 'Phone Number ID' },
        { official: '收件人号码', nova: '默认接收号码（E.164）', note: '含国家码，如 +86' },
      ],
      checklist: [
        'Token 未过期且权限足够',
        'Phone Number ID 正确',
        '收件人在会话窗口内或已按模板策略允许触达',
      ],
      warnings: [
        '自由文本受 Meta 24 小时会话窗口限制',
        '本路径为 Cloud API 出站，不是 App 对话所用的 bridge',
      ],
    },
    chat: {
      brand: 'whatsapp',
      title: 'WhatsApp · App 对话（私有化 Bridge）',
      subtitle: '自建 bridge 进程 → 配置路径/URL → 谨慎启用',
      overview:
        '双向 WhatsApp 对话依赖本地或私有化 bridge 进程，云上 SaaS 默认不建议开启。仅在有运维能力的私有化环境使用。',
      steps: [
        {
          title: '部署 WhatsApp Bridge',
          body: '按私有化方案部署 bridge 服务，确认进程可监听本地或内网地址。',
          uiHint: '私有化主机 / Docker',
          tip: '具体镜像与脚本以你们私有化交付说明为准。',
        },
        {
          title: '确认 Bridge 可访问',
          body: '记录 bridge 脚本绝对路径，或 HTTP 服务 URL（如 http://127.0.0.1:3000）。',
          uiHint: 'bridgePath / bridgeUrl',
        },
        {
          title: '填入本系统',
          body: '后台「App 对话 → WhatsApp」填写 Bridge 脚本路径与可选 URL，保存凭证。',
          uiHint: '后台 → App 对话',
        },
        {
          title: '启用前评估',
          body: '仅在 PILOTDECK_IM_CHANNELS 允许且运维认可后启用。云上多租户环境请保持关闭。',
        },
      ],
      fieldMap: [
        { official: 'Bridge 可执行/脚本', nova: 'Bridge 脚本路径' },
        { official: 'Bridge HTTP 地址', nova: 'Bridge URL（可选）' },
      ],
      checklist: [
        'bridge 进程健康',
        '路径或 URL 本机可达',
        '已充分评估云上风险后再启用',
      ],
      warnings: [
        '云 SaaS 默认不建议开启',
        '勿把 WhatsApp bridge 当作开箱即用能力对外承诺',
      ],
    },
  },
};

export function getImHelpGuide(brand: ImBrandId, mode: ImHelpMode): ImHelpGuide {
  return GUIDES[brand][mode];
}

export const IM_HELP_BRANDS: Array<{ id: ImBrandId; label: string }> = [
  { id: 'wecom', label: '企业微信' },
  { id: 'dingtalk', label: '钉钉' },
  { id: 'whatsapp', label: 'WhatsApp' },
];
