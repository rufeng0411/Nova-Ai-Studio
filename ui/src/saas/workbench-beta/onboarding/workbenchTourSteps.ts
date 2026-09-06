// PD-SAAS-FORK: tour step table (shared with WorkbenchTour)

export type WorkbenchTourStep = {
  id: string;
  selector: string;
  fallbackSelector?: string;
  titleKey: string;
  bodyKey: string;
  titleDefault: string;
  bodyDefault: string;
};

export const WORKBENCH_TOUR_STEPS: WorkbenchTourStep[] = [
  {
    id: 'new-chat',
    selector:
      '#beta-new-chat, [data-testid="wb-beta-new-chat"], [data-testid="sidebar-new-chat"], button[aria-label*="新对话"], button[aria-label*="New"]',
    fallbackSelector: 'aside button, [class*="Sidebar"] button',
    titleKey: 'workbenchBeta.tour.step1Title',
    bodyKey: 'workbenchBeta.tour.step1Body',
    titleDefault: '从这里开始一次新任务',
    bodyDefault: '点「新对话」打开欢迎页，也可直接在输入框说明需求。',
  },
  {
    id: 'composer-caps',
    selector:
      '[data-testid="wb-beta-composer-caps"], [data-testid="composer-capabilities"], button[aria-label*="能力"]',
    titleKey: 'workbenchBeta.tour.step2Title',
    bodyKey: 'workbenchBeta.tour.step2Body',
    titleDefault: '不知道怎么说时，点这里挑能力',
    bodyDefault: '能力中心与输入框「能力」是同一入口，点卡片即可预填。',
  },
  {
    id: 'deliverables',
    selector:
      '[data-testid="wb-beta-deliverable-bar"], [data-testid="session-deliverable-summary"], [class*="SessionDeliverable"]',
    fallbackSelector: '[data-testid="top-tab-discover"], nav a, [role="tab"]',
    titleKey: 'workbenchBeta.tour.step3Title',
    bodyKey: 'workbenchBeta.tour.step3Body',
    titleDefault: '做完的成果会收在清单里',
    bodyDefault: '底部成果清单可展开预览；右栏只看任务文件夹，不会串台。',
  },
];
