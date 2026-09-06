import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 BarChart3,
 Bot,
 Database,
 Folder,
 PanelLeftOpen,
 Radio,
 Sparkles,
 type LucideIcon,
} from 'lucide-react';
import type {
  AlwaysOnDashboardEvent,
  AlwaysOnDashboardEventsResponse,
  AlwaysOnSubTab,
  AppTab,
  Project,
  ProjectSession,
} from '../../types/app';
import MainContent from '../main-content/view/MainContent';
import type { MainContentProps } from '../main-content/types/types';
import { cn } from '../../lib/utils.js';
import { projectDisplayName, sessionDisplayTitle, useCustomNamesVersion } from '../../lib/customNames';
import { resolveMobileChatSubtitle, resolveMobileChatTitle } from '../../shared/projectLabels';
import { api } from '../../utils/api';
// PD-SAAS-FORK: mobile shell (bottom tab bar + mobile header + me screen)
import MobileHeader from '../../mobile/MobileHeader';
import MobileTabBar, { type MobileTab } from '../../mobile/MobileTabBar';
import InstallPrompt from '../../mobile/InstallPrompt';
import MobileMeScreen from '../../mobile/MobileMeScreen';
import MobileTasksScreen from '../../mobile/MobileTasksScreen';
import { MobileHubSearchProvider, useMobileHubSearch } from '../../mobile/MobileHubSearchContext';
import { useMobileViewport } from '../../mobile/useMobileViewport';

type Tab = { id: AppTab; labelKey: string; icon: LucideIcon };

// Order matches the primary work modes in the shell. The Agent tab owns both
// the new-session welcome state and existing conversation transcripts.
// Plugin tabs aren't surfaced in this static list.
//
// Shell + Source Control intentionally left out of the visible bar — both
// tools are still reachable via plugin tabs / programmatic activeTab if a
// future feature needs them, but they were noisy in the day-to-day flow.
const TABS: Tab[] = [
 { id: 'chat', labelKey: 'tabs.chat', icon: Bot },
 { id: 'files', labelKey: 'tabs.files', icon: Folder },
 // >>> pilotdeck-fork: capability-hub
 { id: 'discover', labelKey: 'tabs.discover', icon: Sparkles },
 // <<< pilotdeck-fork: capability-hub
 { id: 'dashboard', labelKey: 'tabs.dashboard', icon: BarChart3 },
 { id: 'memory', labelKey: 'tabs.memory', icon: Database },
 { id: 'always-on', labelKey: 'tabs.alwaysOn', icon: Radio },
];

const ALWAYS_ON_EVENT_BADGE_POLL_INTERVAL_MS = 15_000;
const ALWAYS_ON_LAST_VIEWED_MARKER_KEY = 'pilotdeck:always-on-last-viewed-marker';
const ALWAYS_ON_EVENT_BADGE_LIMIT = 200;

const BADGE_EVENT_PHASES = new Set<AlwaysOnDashboardEvent['phase']>([
  'plan_produced',
  'report_produced',
]);

const getBadgeEventMarker = (events: AlwaysOnDashboardEvent[]): string | null => {
  const latestBadgeEvent = events
    .filter((event) => BADGE_EVENT_PHASES.has(event.phase))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];

  return latestBadgeEvent ? `${latestBadgeEvent.timestamp}:${latestBadgeEvent.eventId}` : null;
};

// V2 main shell: breadcrumb on the left, tool switcher on the right, and the
// active tool's content below. The sidebar stays focused on projects+sessions.
type MainAreaV2Props = MainContentProps & {
 selectedProject: Project | null;
 selectedSession: ProjectSession | null;
 activeTab: AppTab;
 isSidebarCollapsed?: boolean;
 onOpenSidebar?: () => void;
};

export default function MainAreaV2(props: MainAreaV2Props) {
 const { t } = useTranslation();
 const {
 selectedProject,
 selectedSession,
 activeTab,
 setActiveTab,
 isSidebarCollapsed,
 onOpenSidebar,
 isMobile,
 onMenuClick,
 onStartNewSession,
 onShowSettings,
 } = props;
 const [alwaysOnSubTab, setAlwaysOnSubTab] = useState<AlwaysOnSubTab>('dashboard');
 // PD-SAAS-FORK: mobile "Me" screen overlays MainContent (kept mounted below).
 const [mobileMeOpen, setMobileMeOpen] = useState(false);
 // PD-SAAS-FORK: hide the bottom tab bar while the soft keyboard is open.
 const { isKeyboardOpen } = useMobileViewport(isMobile);
 const [latestAlwaysOnEventMarker, setLatestAlwaysOnEventMarker] = useState<string | null>(null);
 const [lastViewedAlwaysOnEventMarker, setLastViewedAlwaysOnEventMarker] = useState<string | null>(
 () => localStorage.getItem(ALWAYS_ON_LAST_VIEWED_MARKER_KEY),
 );

 useEffect(() => {
 if (activeTab === 'home') {
 setActiveTab('chat');
 } else if (activeTab === 'skills') {
 // PD-SAAS-FORK: skills management lives in admin only.
 setActiveTab('discover');
 }
 }, [activeTab, setActiveTab]);

 useEffect(() => {
 let cancelled = false;

 const refreshAlwaysOnEventMarker = async () => {
 try {
 const response = await api.alwaysOnDashboardEvents(ALWAYS_ON_EVENT_BADGE_LIMIT);
 if (!response.ok) {
 return;
 }

 const payload = (await response.json()) as AlwaysOnDashboardEventsResponse;

 if (!cancelled) {
 const marker = Array.isArray(payload.events) ? getBadgeEventMarker(payload.events) : null;
 setLatestAlwaysOnEventMarker(marker);

 if (marker && !localStorage.getItem(ALWAYS_ON_LAST_VIEWED_MARKER_KEY)) {
 setLastViewedAlwaysOnEventMarker(marker);
 localStorage.setItem(ALWAYS_ON_LAST_VIEWED_MARKER_KEY, marker);
 }
 }
 } catch {
 // Keep the previous marker when the lightweight notification poll fails.
 }
 };

 void refreshAlwaysOnEventMarker();
 const timer = window.setInterval(() => {
 void refreshAlwaysOnEventMarker();
 }, ALWAYS_ON_EVENT_BADGE_POLL_INTERVAL_MS);

 return () => {
 cancelled = true;
 window.clearInterval(timer);
 };
 }, []);

 useEffect(() => {
 if (activeTab === 'always-on' && latestAlwaysOnEventMarker) {
 setLastViewedAlwaysOnEventMarker(latestAlwaysOnEventMarker);
 localStorage.setItem(ALWAYS_ON_LAST_VIEWED_MARKER_KEY, latestAlwaysOnEventMarker);
 }
 }, [activeTab, latestAlwaysOnEventMarker]);

 // Re-render breadcrumb when the user renames a project/session via the
 // sidebar overlay (subscribes to localStorage + custom event).
 useCustomNamesVersion();

 // Breadcrumb: "ProjectName / Tab" with optional session summary appended in
 // mono. Falls back to "Home" when no project is selected so the breadcrumb
 // never collapses to "/". Project + session strings flow through the
 // customNames overlay so user renames in the sidebar reflect here too.
 const displayActiveTab = activeTab === 'home' ? 'chat' : activeTab;
 const tabLabelKey = TABS.find((tab) => tab.id === displayActiveTab)?.labelKey;
 const tabLabel = tabLabelKey
 ? t(tabLabelKey)
 : displayActiveTab.startsWith('plugin:')
 ? displayActiveTab.replace('plugin:', '')
 : displayActiveTab;
 const sessionSummary = selectedSession ? sessionDisplayTitle(selectedSession) : '';
 const alwaysOnUnread = Boolean(
 latestAlwaysOnEventMarker &&
 activeTab !== 'always-on' &&
 latestAlwaysOnEventMarker !== lastViewedAlwaysOnEventMarker,
 );

 // PD-SAAS-FORK: mobile shell — bottom tab bar + mobile header replace the
 // desktop breadcrumb/tab-pill chrome. MainContent stays mounted under the
 // "Me" overlay so chat/session state survives tab hops.
 const activeMobileTab: MobileTab = mobileMeOpen
 ? 'me'
 : displayActiveTab === 'discover'
 ? 'discover'
 : displayActiveTab === 'files'
 ? 'files'
 : 'chat';

 const handleSelectMobileTab = useCallback(
 (tab: MobileTab) => {
 if (tab === 'me') {
 setMobileMeOpen(true);
 return;
 }
 setMobileMeOpen(false);
 setActiveTab(tab);
 },
 [setActiveTab],
 );

 if (isMobile) {
 // PD-SAAS-FORK: never surface raw "general" in mobile chrome.
 const mobileTitle =
 activeMobileTab === 'me'
 ? (t('common:mobile.me.title', { defaultValue: '我的' }) as string)
 : activeMobileTab === 'chat'
 ? resolveMobileChatTitle({ project: selectedProject, session: selectedSession, t })
 : (tabLabel as string);
 const mobileSubtitle =
 activeMobileTab === 'chat'
 ? resolveMobileChatSubtitle({ project: selectedProject, session: selectedSession, t })
 : undefined;

 return (
 <MobileHubSearchProvider enabled={activeMobileTab === 'discover'}>
 <MobileShellBody
 {...props}
 activeMobileTab={activeMobileTab}
 mobileTitle={mobileTitle}
 mobileSubtitle={mobileSubtitle}
 alwaysOnSubTab={alwaysOnSubTab}
 onAlwaysOnSubTabChange={setAlwaysOnSubTab}
 mobileMeOpen={mobileMeOpen}
 isKeyboardOpen={isKeyboardOpen}
 onSelectMobileTab={handleSelectMobileTab}
 />
 </MobileHubSearchProvider>
 );
 }

 return (
 <div className="flex h-full min-w-0 flex-col bg-background text-foreground">
 {/* Header: breadcrumb left, tool switcher right. */}
 <header className="flex h-12 shrink-0 items-center px-6">
 {isSidebarCollapsed ? (
 // Just the "expand sidebar" affordance — the PilotDeck logo lives
 // in the sidebar header, so showing a duplicate badge here when
 // the sidebar is collapsed feels redundant.
 <button
 type="button"
 onClick={onOpenSidebar}
 aria-label={t('sidebar:tooltips.showSidebar', { defaultValue: 'Show sidebar' }) as string}
 title={t('sidebar:tooltips.showSidebar', { defaultValue: 'Show sidebar' }) as string}
 className="mr-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
 </button>
 ) : null}
  <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
    {selectedProject && selectedProject.name !== 'general' ? (
      <>
        <span className="shrink-0 text-muted-foreground">
          {projectDisplayName(selectedProject)}
        </span>
        <span className="shrink-0 text-muted-foreground/60">/</span>
      </>
    ) : null}
    <span className="shrink-0 font-medium">{tabLabel}</span>
 {sessionSummary ? (
 <span
 className="ml-2 min-w-0 max-w-[28rem] truncate font-mono text-[11px] text-muted-foreground"
 title={sessionSummary}
 >
 {sessionSummary}
 </span>
 ) : null}
 </div>

 <div
 role="tablist"
 aria-label={t('tabsNavLabel')}
 className="scrollbar-thin ml-4 flex h-9 max-w-[70%] shrink-0 items-center gap-1 overflow-x-auto"
 >
 {TABS.map((tab) => {
 const Icon = tab.icon;
 const isActive = displayActiveTab === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 role="tab"
 aria-selected={isActive}
 onClick={() => setActiveTab(tab.id)}
 className={cn(
 'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
 isActive
 ? 'bg-accent font-medium text-accent-foreground shadow-xs'
 : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
 )}
 >
 <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
 <span>{t(tab.labelKey)}</span>
 {tab.id === 'always-on' && alwaysOnUnread ? (
 <span
 aria-hidden="true"
 className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
 />
 ) : null}
 </button>
 );
 })}
 </div>
 </header>

 {/* Body */}
 <div className="min-h-0 flex-1 overflow-hidden">
 <MainContent
 {...props}
 alwaysOnSubTab={alwaysOnSubTab}
 onAlwaysOnSubTabChange={setAlwaysOnSubTab}
 />
 </div>
 </div>
 );
}

type MobileShellBodyProps = MainAreaV2Props & {
 activeMobileTab: MobileTab;
 mobileTitle: string;
 mobileSubtitle?: string;
 alwaysOnSubTab: AlwaysOnSubTab;
 onAlwaysOnSubTabChange: (tab: AlwaysOnSubTab) => void;
 mobileMeOpen: boolean;
 isKeyboardOpen: boolean;
 onSelectMobileTab: (tab: MobileTab) => void;
};

function MobileShellBody({
 activeMobileTab,
 mobileTitle,
 mobileSubtitle,
 alwaysOnSubTab,
 onAlwaysOnSubTabChange,
 mobileMeOpen,
 isKeyboardOpen,
 onSelectMobileTab,
 ...mainContentProps
}: MobileShellBodyProps) {
 const { t } = useTranslation('capabilities');
 const hubSearchCtx = useMobileHubSearch();
 const { onMenuClick, onStartNewSession, onShowSettings, selectedProject } = mainContentProps;

 const hubSearch =
 activeMobileTab === 'discover' && hubSearchCtx
 ? {
 open: hubSearchCtx.searchOpen,
 query: hubSearchCtx.hubSearch?.query ?? '',
 placeholder: t('searchPlaceholderMobile'),
 onToggle: hubSearchCtx.toggleSearch,
 onQueryChange: hubSearchCtx.hubSearch?.setQuery ?? (() => {}),
 }
 : undefined;

 return (
 <div className="flex h-full min-w-0 flex-col bg-background text-foreground">
 <MobileHeader
 title={mobileTitle}
 subtitle={mobileSubtitle}
 onMenuClick={onMenuClick}
 onNewSession={
 activeMobileTab === 'chat' && selectedProject
 ? () => onStartNewSession(selectedProject)
 : undefined
 }
 hubSearch={hubSearch}
 />
 <div className="relative min-h-0 flex-1 overflow-hidden">
 <div className={cn('h-full', mobileMeOpen && 'hidden')}>
 <MainContent
 {...mainContentProps}
 alwaysOnSubTab={alwaysOnSubTab}
 onAlwaysOnSubTabChange={onAlwaysOnSubTabChange}
 />
 </div>
 {mobileMeOpen ? (
 <div className="absolute inset-0">
 <MobileMeScreen
 selectedProject={selectedProject}
 onShowSettings={onShowSettings}
 tasksView={<MobileTasksScreen />}
 />
 </div>
 ) : null}
 </div>
 {!isKeyboardOpen ? (
 <MobileTabBar active={activeMobileTab} onSelect={onSelectMobileTab} />
 ) : null}
 <InstallPrompt />
 </div>
 );
}
