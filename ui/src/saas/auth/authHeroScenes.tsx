/**
 * PD-SAAS-FORK: Shared login hero scene visuals (desktop + mobile).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Globe2, Image as ImageIcon, Presentation, Video } from 'lucide-react';
import {
  PRODUCT_HIGHLIGHT_ORDER,
  PRODUCT_HIGHLIGHT_STAT_INDEX,
  PRODUCT_INFO_STAT_KEYS,
  SECURITY_ORBIT_NODES,
  type ProductHighlightId,
} from '../brand/productHighlights';

export const AUTH_HERO_SCENE_MS = 4320;
/** PD-SAAS-FORK: mobile carousel — 30% faster scene rotation */
export const AUTH_HERO_SCENE_MS_MOBILE = Math.round(AUTH_HERO_SCENE_MS * 0.7);

const HeroSceneDurationContext = createContext(AUTH_HERO_SCENE_MS);

export function HeroSceneDurationProvider({
  durationMs = AUTH_HERO_SCENE_MS,
  children,
}: {
  durationMs?: number;
  children: ReactNode;
}) {
  return <HeroSceneDurationContext.Provider value={durationMs}>{children}</HeroSceneDurationContext.Provider>;
}

export function useHeroSceneDuration(): number {
  return useContext(HeroSceneDurationContext);
}

export const AUTH_HERO_STAT_KEYS = PRODUCT_INFO_STAT_KEYS;

function CountUp({ to, duration = 1020 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return <>{value}</>;
}

function TypeChars({ text, baseDelay = 0, step = 48 }: { text: string; baseDelay?: number; step?: number }) {
  return (
    <>
      {Array.from(text).map((char, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="hero-type-char"
          style={{ animationDelay: `${baseDelay + index * step}ms` }}
        >
          {char}
        </span>
      ))}
    </>
  );
}

const HARNESS_TOOLS = [
  { id: 'image', label: '图像生成', icon: ImageIcon, tone: 'violet' },
  { id: 'video', label: '视频生成', icon: Video, tone: 'sky' },
  { id: 'web', label: '网页抓取', icon: Globe2, tone: 'emerald' },
] as const;

const HARNESS_OUTPUTS = ['宣传.mp4', '主图.png', '竞品页.html'];

function SceneAgentHarness() {
  const prompt = '生成宣传视频并抓取竞品官网';

  return (
    <div className="hero-harness">
      <div className="hero-harness-prompt">
        <span className="hero-harness-prompt-prefix">›</span>
        <span className="hero-harness-prompt-text">
          <TypeChars text={prompt} baseDelay={80} step={38} />
        </span>
        <span className="hero-caret" />
      </div>

      <div className="hero-harness-stage">
        <svg viewBox="0 0 360 188" className="hero-harness-svg" aria-hidden>
          {HARNESS_TOOLS.map((tool, index) => {
            const y = 34 + index * 56;
            return (
              <g key={tool.id}>
                <path
                  d={`M72 ${y} C 118 ${y}, 128 94, 168 94`}
                  className="hero-harness-wire"
                  style={{ animationDelay: `${180 + index * 110}ms` }}
                />
                <circle
                  cx="64"
                  cy={y}
                  r="3.5"
                  className={`hero-harness-node hero-harness-node-${tool.tone}`}
                  style={{ animationDelay: `${180 + index * 110}ms` }}
                />
              </g>
            );
          })}
          <path d="M198 94 C 238 94, 252 94, 296 94" className="hero-harness-wire hero-harness-wire-out" />
          <circle cx="302" cy="94" r="4" className="hero-harness-node hero-harness-node-out" />
        </svg>

        <div className="hero-harness-tools">
          {HARNESS_TOOLS.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className={`hero-harness-tool hero-harness-tool--${tool.tone}`}
                style={{ animationDelay: `${260 + index * 120}ms` }}
              >
                <Icon className="hero-harness-tool-icon" strokeWidth={1.75} aria-hidden />
                <span>{tool.label}</span>
              </div>
            );
          })}
        </div>

        <div className="hero-harness-hub">
          <span className="hero-harness-hub-glow" aria-hidden />
          <span className="hero-harness-hub-orbit hero-harness-hub-orbit-a" aria-hidden />
          <span className="hero-harness-hub-orbit hero-harness-hub-orbit-b" aria-hidden />
          <span className="hero-harness-hub-label">Harness</span>
          <span className="hero-harness-hub-meta">Skills · MCP</span>
        </div>

        <div className="hero-harness-deliver">
          <span className="hero-harness-deliver-path">artifacts/</span>
          <div className="hero-harness-deliver-items">
            {HARNESS_OUTPUTS.map((name, index) => (
              <span
                key={name}
                className="hero-harness-deliver-item"
                style={{ animationDelay: `${920 + index * 130}ms` }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneConversation() {
  const prompt = '帮我做一套新品上市营销全案';
  const cards = [
    { icon: FileText, name: '市场调研报告.md', tag: '调研' },
    { icon: ImageIcon, name: '视觉创意 9 图', tag: '创意' },
    { icon: Presentation, name: '投放执行方案.pptx', tag: '策划' },
  ];

  return (
    <div className="hero-conv">
      <div className="hero-conv-input">
        <span className="hero-conv-prefix">›</span>
        <span className="hero-conv-text">
          <TypeChars text={prompt} baseDelay={120} />
        </span>
        <span className="hero-caret" />
      </div>
      <div className="hero-conv-cards">
        {cards.map((card, index) => (
          <div
            key={card.name}
            className="hero-conv-card"
            style={{ animationDelay: `${900 + index * 156}ms` }}
          >
            <card.icon className="hero-conv-card-icon" strokeWidth={1.75} />
            <span className="hero-conv-card-name">{card.name}</span>
            <span className="hero-conv-card-tag">{card.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneTokenSavings() {
  return (
    <div className="hero-save">
      <div className="hero-save-bars" aria-hidden>
        <div className="hero-save-col">
          <div className="hero-save-bar-wrap">
            <div className="hero-save-bar hero-save-bar-full" />
          </div>
          <span className="hero-save-bar-label">全旗舰模型</span>
          <span className="hero-save-bar-cost">100%</span>
        </div>
        <div className="hero-save-col hero-save-col-routed">
          <div className="hero-save-bar-wrap">
            <div className="hero-save-bar hero-save-bar-routed" />
          </div>
          <span className="hero-save-bar-label">智能路由</span>
          <span className="hero-save-bar-cost hero-save-bar-cost-good">≈22%</span>
        </div>
      </div>
      <div className="hero-save-badge">
        <strong>
          −<CountUp to={70} />
          <em>%</em>
        </strong>
        <span>Token 节省</span>
      </div>
      <div className="hero-save-tiers">
        <span className="hero-save-tier hero-save-tier-hard">复杂 · 旗舰</span>
        <span className="hero-save-tier-arrow" aria-hidden>
          →
        </span>
        <span className="hero-save-tier hero-save-tier-light">简单 · 轻量</span>
      </div>
    </div>
  );
}

const RESEARCH_GROWTH_QUERY = '查询行业机会与目标客群';
const RESEARCH_GROWTH_INTEL = ['市场洞察', '竞品分析', '舆情监测'];
const RESEARCH_GROWTH_LEADS = ['精准线索', '客户画像', '智能触达'];

/** Multi-source research intel flowing into lead acquisition pipeline. */
function SceneResearchGrowth() {
  return (
    <div className="hero-rg">
      <div className="hero-rg-query">
        <span className="hero-rg-query-icon" aria-hidden>
          ⌕
        </span>
        <span className="hero-rg-query-text">
          <TypeChars text={RESEARCH_GROWTH_QUERY} baseDelay={80} step={42} />
        </span>
        <span className="hero-rg-query-scan" aria-hidden />
      </div>
      <div className="hero-rg-split">
        <div className="hero-rg-col hero-rg-col-research">
          <span className="hero-rg-col-label">调研分析</span>
          <div className="hero-rg-chips">
            {RESEARCH_GROWTH_INTEL.map((tag, index) => (
              <span
                key={tag}
                className="hero-rg-chip hero-rg-chip-research"
                style={{ animationDelay: `${520 + index * 140}ms` }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-rg-bridge" aria-hidden>
          <div className="hero-rg-bridge-track">
            <div className="hero-rg-bridge-fill" />
          </div>
          <span className="hero-rg-bridge-node hero-rg-bridge-node-a" />
          <span className="hero-rg-bridge-node hero-rg-bridge-node-b" />
        </div>
        <div className="hero-rg-col hero-rg-col-acquire">
          <span className="hero-rg-col-label">智能获客</span>
          <div className="hero-rg-chips">
            {RESEARCH_GROWTH_LEADS.map((tag, index) => (
              <span
                key={tag}
                className="hero-rg-chip hero-rg-chip-acquire"
                style={{ animationDelay: `${1080 + index * 150}ms` }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FLYWHEEL_STAGES = ['调研', '策划', '创意', '触达', '发布', '监测'];

function SceneFlywheel() {
  const sceneMs = useHeroSceneDuration();
  return (
    <div className="hero-wheel">
      <div className="hero-wheel-sweep" />
      <div className="hero-wheel-ring" />
      {FLYWHEEL_STAGES.map((stage, index) => (
        <div
          key={stage}
          className="hero-wheel-node"
          style={{
            transform: `rotate(${index * 60}deg) translateY(calc(-1 * var(--hero-wheel-orbit, 86px))) rotate(${-index * 60}deg)`,
            animationDelay: `${index * (sceneMs / FLYWHEEL_STAGES.length)}ms`,
          }}
        >
          {stage}
        </div>
      ))}
      <div className="hero-wheel-center">
        <strong>营销飞轮</strong>
        <span>六阶段闭环</span>
      </div>
    </div>
  );
}

const DOMAIN_TAGS = ['营销', '办公', '创作', '开发', '教育'];

function SceneCapabilities() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        dx: Math.round((Math.random() - 0.5) * 220),
        dy: Math.round((Math.random() - 0.5) * 160),
        delay: Math.round(Math.random() * 360),
      })),
    [],
  );

  return (
    <div className="hero-cap">
      <div className="hero-cap-count">
        <strong>
          <CountUp to={365} />
          <em>+</em>
        </strong>
        <span>项即用能力</span>
      </div>
      <div className="hero-cap-grid">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="hero-cap-dot"
            style={{
              '--dx': `${particle.dx}px`,
              '--dy': `${particle.dy}px`,
              animationDelay: `${particle.delay}ms`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="hero-cap-tags">
        {DOMAIN_TAGS.map((tag, index) => (
          <span key={tag} className="hero-cap-tag" style={{ animationDelay: `${540 + index * 108}ms` }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

const MODEL_NODES = ['GPT', 'Claude', 'Gemini', '通义', 'Seedream'];

function SceneModels() {
  return (
    <div className="hero-pipes">
      <svg viewBox="0 0 340 190" className="hero-pipes-svg" aria-hidden>
        {MODEL_NODES.map((name, index) => {
          const y = 22 + index * 36;
          return (
            <g key={name}>
              <path
                d={`M64 ${y} C 120 ${y}, 130 95, 186 95`}
                className="hero-pipe"
                style={{ animationDelay: `${index * 144}ms` }}
              />
              <circle cx="56" cy={y} r="4" className="hero-pipe-node" style={{ animationDelay: `${index * 144}ms` }} />
              <text x="46" y={y + 4} textAnchor="end" className="hero-pipe-label">
                {name}
              </text>
            </g>
          );
        })}
        <path d="M196 95 C 240 95, 250 95, 296 95" className="hero-pipe hero-pipe-out" />
        <circle cx="191" cy="95" r="13" className="hero-pipe-hub" />
        <circle cx="191" cy="95" r="6" className="hero-pipe-hub-core" />
        <circle cx="300" cy="95" r="5" className="hero-pipe-node hero-pipe-node-out" />
        <text x="300" y="118" textAnchor="middle" className="hero-pipe-label">
          成果
        </text>
      </svg>
    </div>
  );
}

const PIPELINE_STEPS = ['选题大纲', '内容 PPT', '动效视频', '一键发布'];

function ScenePipeline() {
  return (
    <div className="hero-line">
      <div className="hero-line-track">
        <div className="hero-line-fill" />
      </div>
      <div className="hero-line-steps">
        {PIPELINE_STEPS.map((step, index) => (
          <div key={step} className="hero-line-step" style={{ animationDelay: `${300 + index * 510}ms` }}>
            <span className="hero-line-node" />
            <span className="hero-line-label">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECURITY_ORBIT_RADIUS = 82;
const SECURITY_ORBIT_CX = 160;
const SECURITY_ORBIT_CY = 96;

function SceneEnterpriseSecurity() {
  const { t } = useTranslation('common');

  return (
    <div className="hero-sec-orbit" aria-hidden>
      <svg viewBox="0 0 320 192" className="hero-sec-orbit-svg">
        <circle cx={SECURITY_ORBIT_CX} cy={SECURITY_ORBIT_CY} r={SECURITY_ORBIT_RADIUS} className="hero-sec-orbit-ring" />
        {SECURITY_ORBIT_NODES.map((node, index) => {
          const angle = ((index * 360) / SECURITY_ORBIT_NODES.length - 90) * (Math.PI / 180);
          const x = SECURITY_ORBIT_CX + SECURITY_ORBIT_RADIUS * Math.cos(angle);
          const y = SECURITY_ORBIT_CY + SECURITY_ORBIT_RADIUS * Math.sin(angle);
          return (
            <line
              key={node.id}
              x1={SECURITY_ORBIT_CX}
              y1={SECURITY_ORBIT_CY}
              x2={x}
              y2={y}
              className="hero-sec-orbit-spoke"
              style={{ animationDelay: `${120 + index * 90}ms` }}
            />
          );
        })}
      </svg>
      <div className="hero-sec-orbit-core">
        <div className="hero-sec-orbit-core-glow" />
        <svg viewBox="0 0 48 52" className="hero-sec-orbit-shield" aria-hidden>
          <path
            d="M24 3 L42 12 V26 C42 36 34 44 24 48 C14 44 6 36 6 26 V12 Z"
            className="hero-sec-orbit-shield-body"
          />
          <path
            d="M17 26 L22 31 L32 21"
            className="hero-sec-orbit-shield-check"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {SECURITY_ORBIT_NODES.map((node, index) => (
        <div
          key={node.id}
          className="hero-sec-orbit-node"
          style={
            {
              '--sec-i': index,
              animationDelay: `${220 + index * 95}ms`,
            } as CSSProperties
          }
        >
          <span className="hero-sec-orbit-node-chip">
            <span className="hero-sec-orbit-node-dot" />
            {t(`productInfo.securityNodes.${node.id}`)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const AUTH_HERO_SCENE_RENDERERS: Record<ProductHighlightId, ComponentType> = {
  'agent-harness': SceneAgentHarness,
  conversation: SceneConversation,
  'token-savings': SceneTokenSavings,
  flywheel: SceneFlywheel,
  'research-growth': SceneResearchGrowth,
  capabilities: SceneCapabilities,
  models: SceneModels,
  pipeline: ScenePipeline,
  security: SceneEnterpriseSecurity,
};

export const AUTH_HERO_SCENES = PRODUCT_HIGHLIGHT_ORDER.map((id) => ({
  id,
  statIndex: PRODUCT_HIGHLIGHT_STAT_INDEX[id] ?? null,
  render: AUTH_HERO_SCENE_RENDERERS[id],
}));
