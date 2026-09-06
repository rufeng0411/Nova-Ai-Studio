/**
 * PD-SAAS-FORK: Login page left-panel hero showcase (desktop).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_HERO_SCENES,
  AUTH_HERO_SCENE_MS,
  AUTH_HERO_STAT_KEYS,
  HeroSceneDurationProvider,
} from './authHeroScenes';
import '../theme/saasAuthHero.css';

export default function AuthHeroShowcase() {
  const { t } = useTranslation('common');
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    const start = () => setAnimReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(start, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!animReady || paused) return undefined;
    const timer = setTimeout(() => {
      setPrev(active);
      setActive((value) => (value + 1) % AUTH_HERO_SCENES.length);
    }, AUTH_HERO_SCENE_MS);
    return () => clearTimeout(timer);
  }, [active, paused, cycle, animReady]);

  const jumpTo = (index: number) => {
    if (index === active) return;
    setPrev(active);
    setActive(index);
    setCycle((value) => value + 1);
  };

  const activeStat = AUTH_HERO_SCENES[active].statIndex;

  return (
    <HeroSceneDurationProvider durationMs={AUTH_HERO_SCENE_MS}>
    <div
      className={`hero-showcase${paused ? ' is-paused' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setCycle((value) => value + 1);
      }}
    >
      <div className="hero-stage">
        {AUTH_HERO_SCENES.map((scene, index) => {
          const isActive = index === active;
          const isLeaving = index === prev && !isActive;
          if (!isActive && !isLeaving) {
            return <div key={scene.id} className="hero-scene" aria-hidden />;
          }
          const SceneVisual = scene.render;
          return (
            <div
              key={scene.id}
              className={`hero-scene${isActive ? ' is-active' : ''}${isLeaving ? ' is-leaving' : ''}`}
              aria-hidden={!isActive}
            >
              <div className="hero-scene-inner" key={isActive ? `on-${cycle}` : 'off'}>
                <div className="hero-visual">
                  <SceneVisual />
                </div>
                <h1 className="hero-title">{t(`productInfo.highlights.${scene.id}.title`)}</h1>
                <p className="hero-subtitle">{t(`productInfo.highlights.${scene.id}.heroSubtitle`)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hero-indicators" role="tablist" aria-label="特性场景">
        {AUTH_HERO_SCENES.map((scene, index) => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={t(`productInfo.highlights.${scene.id}.title`)}
            className={`hero-indicator${index === active ? ' is-active' : ''}`}
            onClick={() => jumpTo(index)}
          >
            {index === active ? <span key={`fill-${cycle}`} className="hero-indicator-fill" /> : null}
          </button>
        ))}
      </div>

      <div className="saas-auth-stats hero-stats">
        {AUTH_HERO_STAT_KEYS.map((key, index) => (
          <div
            key={key}
            className={`saas-auth-stat${activeStat === index ? ' hero-stat-glow' : ''}`}
          >
            <strong>{t(`productInfo.stats.${key}.value`)}</strong>
            <span>{t(`productInfo.stats.${key}.label`)}</span>
          </div>
        ))}
      </div>
    </div>
    </HeroSceneDurationProvider>
  );
}
