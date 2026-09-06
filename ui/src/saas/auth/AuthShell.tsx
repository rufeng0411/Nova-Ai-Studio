import { lazy, Suspense, useState, type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';



import { useMobileViewport } from '../../mobile/useMobileViewport';

import NovaBrandLockup from '../brand/NovaBrandLockup';
import NovaProductCopyright from '../brand/NovaProductCopyright';
import { NOVA_PRODUCT_NAME } from '../brand/productInfo';



// PD-SAAS-FORK: 登录 Hero 路由级 code-split，已登录用户不进主包
const AuthHeroShowcase = lazy(() => import('./AuthHeroShowcase'));
const AuthHeroShowcaseMobile = lazy(() => import('./AuthHeroShowcaseMobile'));

import { useMobileAuthLayout } from './useMobileAuthLayout';



import ProductInfoDialog from '../brand/ProductInfoDialog';

import '../theme/saasAuth.css';

type AuthShellProps = {
  children: ReactNode;
};



type MobileAuthFrame = 'showcase' | 'login';



export default function AuthShell({ children }: AuthShellProps) {

  const { t } = useTranslation(['auth', 'common']);

  const [showProductInfo, setShowProductInfo] = useState(false);

  const [mobileFrame, setMobileFrame] = useState<MobileAuthFrame>('showcase');

  const isMobileLayout = useMobileAuthLayout();

  useMobileViewport(isMobileLayout);



  const brandButton = (

    <NovaBrandLockup

      as="button"

      type="button"

      className={`saas-auth-brand${isMobileLayout ? '' : ' saas-auth-brand--with-caption'}`}

      logoClassName="saas-auth-brand-logo"

      showCaption={!isMobileLayout}

      captionClassName="saas-auth-brand-caption"

      onClick={() => setShowProductInfo(true)}

      aria-label={t('common:productInfo.openAbout')}

    />

  );



  if (isMobileLayout) {

    const isShowcase = mobileFrame === 'showcase';

    return (

      <div className="saas-auth-root saas-auth-root--mobile" data-testid="saas-auth-shell" data-product={NOVA_PRODUCT_NAME}>

        <header className="saas-auth-mobile-topbar">

          {brandButton}

          <button

            type="button"

            className="saas-auth-mobile-toggle mobile-touch-target"

            data-testid="saas-auth-mobile-toggle"

            onClick={() => setMobileFrame(isShowcase ? 'login' : 'showcase')}

          >

            {isShowcase ? t('auth:mobile.loginNow') : t('auth:mobile.viewShowcase')}

          </button>

        </header>



        <div className="saas-auth-mobile-body">

          <section

            className={`saas-auth-mobile-panel saas-auth-mobile-panel--showcase${isShowcase ? ' is-active' : ''}`}

            aria-hidden={!isShowcase}

            aria-label={t('auth:mobile.viewShowcase')}

          >

            <Suspense fallback={<div className="saas-auth-hero-placeholder" aria-hidden />}>
            <AuthHeroShowcaseMobile paused={!isShowcase} />
            </Suspense>

          </section>



          <section

            className={`saas-auth-mobile-panel saas-auth-mobile-panel--login${!isShowcase ? ' is-active' : ''}`}

            aria-hidden={isShowcase}

            aria-label={t('auth:mobile.loginNow')}

          >

            {children}

          </section>

        </div>



        <ProductInfoDialog open={showProductInfo} onClose={() => setShowProductInfo(false)} />

      </div>

    );

  }



  return (

    <div className="saas-auth-root" data-testid="saas-auth-shell" data-product={NOVA_PRODUCT_NAME}>

      <aside className="saas-auth-hero-frame">

        {brandButton}

        <div className="saas-auth-hero">

          <Suspense fallback={<div className="saas-auth-hero-placeholder" aria-hidden />}>
            <AuthHeroShowcase />
          </Suspense>

        </div>

        <NovaProductCopyright className="saas-auth-footer-copy" />

      </aside>

      <main className="saas-auth-login-frame">{children}</main>

      <ProductInfoDialog open={showProductInfo} onClose={() => setShowProductInfo(false)} />

    </div>

  );

}


