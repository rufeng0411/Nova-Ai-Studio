/**
 * PD-SAAS-FORK: Mobile login hero — full desktop scene animations with mobile scale tokens.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_HERO_SCENES,
  AUTH_HERO_SCENE_MS_MOBILE,
  AUTH_HERO_STAT_KEYS,
  HeroSceneDurationProvider,
} from './authHeroScenes';
import NovaProductCopyright from '../brand/NovaProductCopyright';
import '../theme/saasAuthHero.css';
import '../theme/saasAuthHeroMobile.css';

type AuthHeroShowcaseMobileProps = {
  paused?: boolean;
};

export default function AuthHeroShowcaseMobile({ paused = false }: AuthHeroShowcaseMobileProps) {
  const { t } = useTranslation('common');
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => {
      setPrev(active);
      setActive((value) => (value + 1) % AUTH_HERO_SCENES.length);
    }, AUTH_HERO_SCENE_MS_MOBILE);
    return () => clearTimeout(timer);
  }, [active, paused, cycle]);

  const jumpTo = (index: number) => {
    if (index === active) return;
    setPrev(active);
    setActive(index);
    setCycle((value) => value + 1);
  };

  const activeStat = AUTH_HERO_SCENES[active].statIndex;

  return (
    <HeroSceneDurationProvider durationMs={AUTH_HERO_SCENE_MS_MOBILE}>
    <div className={`hm-showcase${paused ? ' is-paused' : ''}`}>
      <div className="hm-stage">
        {AUTH_HERO_SCENES.map((scene, index) => {
          const isActive = index === active;
          const isLeaving = index === prev && !isActive;
          if (!isActive && !isLeaving) {
            return <div key={scene.id} className="hm-scene" aria-hidden />;
          }
          const SceneVisual = scene.render;
          return (
            <div
              key={scene.id}
              className={`hm-scene${isActive ? ' is-active' : ''}${isLeaving ? ' is-leaving' : ''}`}
              aria-hidden={!isActive}
            >
              <div className="hm-scene-inner" key={isActive ? `on-${cycle}` : 'off'}>
                <div className="hm-visual">
                  <SceneVisual />
                </div>
                <h2 className="hm-title">{t(`productInfo.highlights.${scene.id}.title`)}</h2>
                <p className="hm-subtitle">{t(`productInfo.highlights.${scene.id}.heroSubtitle`)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hm-indicators" role="tablist" aria-label="特性场景">
        {AUTH_HERO_SCENES.map((scene, index) => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={t(`productInfo.highlights.${scene.id}.title`)}
            className={`hm-indicator${index === active ? ' is-active' : ''}`}
            onClick={() => jumpTo(index)}
          >
            {index === active ? <span key={`fill-${cycle}`} className="hm-indicator-fill" /> : null}
          </button>
        ))}
      </div>

      <div className="hm-stats saas-auth-stats hero-stats">
        {AUTH_HERO_STAT_KEYS.map((key, index) => (
          <div
            key={key}
            className={`saas-auth-stat hm-stat${activeStat === index ? ' hero-stat-glow' : ''}`}
          >
            <strong>{t(`productInfo.stats.${key}.value`)}</strong>
            <span>{t(`productInfo.stats.${key}.label`)}</span>
          </div>
        ))}
      </div>

      <NovaProductCopyright className="hm-footer" />
    </div>
    </HeroSceneDurationProvider>
  );
}
