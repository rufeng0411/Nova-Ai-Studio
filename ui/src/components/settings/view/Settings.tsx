import { useEffect, useState, type ReactNode } from 'react';
import {
 ArrowUpDown,
 ChevronLeft,
 ChevronRight,
 Code2,
 FileCog,
 Globe2,
 MessageSquare,
 Palette,
 Server,
 Shield,
 UserRound,
 X,
 type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/view/ui';
import { useTheme } from '../../../contexts/ThemeContext';
import { DEFAULT_UI_LANGUAGE, languages } from '../../../i18n/languages';
import { useUiPreferences, type ProcessDetailLevel } from '../../../hooks/useUiPreferences';
import { useSettingsController } from '../hooks/useSettingsController';
import type {
 CodeEditorSettingsState,
 ProjectSortOrder,
 SettingsProps,
} from '../types/types';
import { cn } from '../../../lib/utils';
import SettingsCard from './SettingsCard';
import SettingsRow from './SettingsRow';
import SettingsSection from './SettingsSection';
import SettingsToggle from './SettingsToggle';
import PilotDeckConfigTab from './tabs/PilotDeckConfigTab';
import McpServersTab from './tabs/McpServersTab';
import PermissionsSettingsTab from './tabs/PermissionsSettingsTab';
import { IS_SAAS_MODE } from '../../../constants/config';
import { useAuth } from '../../auth/context/AuthContext';
import { isSaasAdmin } from '../../../saas/auth/roles';
import ProfileSettings from '../../../saas/account/ProfileSettings';
import ProjectContinuitySettingsRow from '../../../saas/account/ProjectContinuitySettingsRow';
import FileStorageSettingsSection from '../../../saas/account/FileStorageSettingsSection';
import {
 TelemetrySettingsRow,
 NovaAboutSection,
} from './sections/PlatformOpsSections';
import DesignCanvasSettingsRow from './sections/DesignCanvasSettingsRow';

type SettingsPage = 'main' | 'config' | 'mcp' | 'permissions' | 'chatInput' | 'codeEditor' | 'profile';
type ThemeMode = 'system' | 'light' | 'dark';

const PLATFORM_SETTINGS_PAGES = new Set<SettingsPage>(['config', 'mcp', 'permissions']);

const pageFromInitialTab = (tab: string): SettingsPage => {
 if (tab === 'config') return 'config';
 if (tab === 'mcp') return 'mcp';
 if (tab === 'permissions') return 'permissions';
 return 'main';
};

function Settings({ isOpen, onClose, projects = [], initialTab = 'appearance' }: SettingsProps) {
 const { t } = useTranslation('settings');
 const { user } = useAuth();
 const canAccessPlatformSettings = !IS_SAAS_MODE || isSaasAdmin(user); // PD-SAAS-FORK
 const {
 saveStatus,
 projectSortOrder,
 setProjectSortOrder,
 codeEditorSettings,
 updateCodeEditorSetting,
 } = useSettingsController({ isOpen, initialTab });
 const [page, setPage] = useState<SettingsPage>(() => pageFromInitialTab(initialTab));

 useEffect(() => {
 if (!isOpen) return;
 let next = pageFromInitialTab(initialTab);
 if (!canAccessPlatformSettings && PLATFORM_SETTINGS_PAGES.has(next)) {
 next = 'main';
 }
 setPage(next);
 }, [isOpen, initialTab, canAccessPlatformSettings]);

 if (!isOpen) {
 return null;
 }

 const title = {
 main: t('title'),
 config: t('mainTabs.config'),
 mcp: t('mcpConfig.title'),
 permissions: t('mainTabs.permissions'),
 chatInput: t('settingsHome.chatInput.title'),
 codeEditor: t('appearanceSettings.codeEditor.title'),
 profile: t('settingsHome.profile.title'),
 }[page];

 const maxWidth = page === 'config' ? 'max-w-[820px]' : 'max-w-[760px]';

 return (
 <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm md:p-4">
 <div className="relative flex h-full w-full flex-col overflow-hidden border border-border bg-background shadow-2xl md:h-[90vh] md:max-w-4xl md:rounded-xl">
 <Button
 variant="ghost"
 size="sm"
 onClick={onClose}
 className="absolute right-4 top-4 z-20 h-9 w-9 touch-manipulation p-0 text-muted-foreground hover:text-foreground active:bg-accent/50"
 aria-label={t('settingsHome.close')}
 >
 <X className="h-4 w-4" />
 </Button>

 <main className="min-h-0 flex-1 overflow-y-auto">
 <div className={cn('mx-auto w-full px-5 py-7 md:px-8 md:py-8', maxWidth)}>
 {page !== 'main' && (
 <button
 type="button"
 onClick={() => setPage('main')}
 className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
 >
 <ChevronLeft className="h-4 w-4" />
 {t('settingsHome.back')}
 </button>
 )}

 <div className="mb-7 flex items-center justify-between gap-6 pr-10">
 <h2 className="text-[26px] font-semibold leading-tight tracking-normal text-foreground">{title}</h2>
 {saveStatus === 'success' && (
 <span className="animate-in fade-in text-xs text-muted-foreground">{t('saveStatus.success')}</span>
 )}
 </div>

 {page === 'main' && (
 <SettingsHome
 projectSortOrder={projectSortOrder}
 onProjectSortOrderChange={setProjectSortOrder}
 onOpenPage={setPage}
 canAccessPlatformSettings={canAccessPlatformSettings}
 />
 )}

 {page === 'config' && canAccessPlatformSettings ? <PilotDeckConfigTab projects={projects} /> : null}
 {page === 'mcp' && canAccessPlatformSettings ? <McpServersTab projects={projects} /> : null}
 {page === 'permissions' && canAccessPlatformSettings ? <PermissionsSettingsTab /> : null}
 {page === 'profile' && <ProfileSettings />}
 {page === 'chatInput' && <ChatInputSettingsPage />}
 {page === 'codeEditor' && (
 <CodeEditorSettingsPage
 settings={codeEditorSettings}
 onWordWrapChange={(value) => updateCodeEditorSetting('wordWrap', value)}
 onShowMinimapChange={(value) => updateCodeEditorSetting('showMinimap', value)}
 onLineNumbersChange={(value) => updateCodeEditorSetting('lineNumbers', value)}
 onFontSizeChange={(value) => updateCodeEditorSetting('fontSize', value)}
 />
 )}
 </div>
 </main>
 </div>
 </div>
 );
}

type SettingsHomeProps = {
 projectSortOrder: ProjectSortOrder;
 onProjectSortOrderChange: (value: ProjectSortOrder) => void;
 onOpenPage: (page: SettingsPage) => void;
 canAccessPlatformSettings: boolean;
};

function SettingsHome({
 projectSortOrder,
 onProjectSortOrderChange,
 onOpenPage,
 canAccessPlatformSettings,
}: SettingsHomeProps) {
 const { t, i18n } = useTranslation('settings');
 const showConfigTab = canAccessPlatformSettings; // PD-SAAS-FORK
 const showMcpTab = canAccessPlatformSettings; // PD-SAAS-FORK: MCP 由平台托管
 const showBasics = showConfigTab || showMcpTab; // PD-SAAS-FORK: hide empty basics group for members
 const showProfile = IS_SAAS_MODE; // PD-SAAS-FORK: account profile + password change
 const showAdvanced = canAccessPlatformSettings; // PD-SAAS-FORK: 权限/遥测仅管理员
 const showAbout = canAccessPlatformSettings; // PD-SAAS-FORK: 关于/版本仅管理员
 const { themeMode = 'system', setThemeMode } = useTheme() as {
 themeMode?: ThemeMode;
 setThemeMode?: (mode: ThemeMode) => void;
 };

 const currentLanguage = languages.some((language) => language.value === i18n.language)
 ? i18n.language
 : DEFAULT_UI_LANGUAGE;

 return (
 <div className="space-y-8">
 {showProfile ? (
 <SettingsGroup title={t('settingsHome.account', { defaultValue: '账户' })}>
 <GroupedCard>
 <NavigationRow
 icon={UserRound}
 title={t('settingsHome.profile.title')}
 detail={t('settingsHome.profile.detail')}
 onClick={() => onOpenPage('profile')}
 />
 </GroupedCard>
 </SettingsGroup>
 ) : null}

 {showBasics ? (
 <SettingsGroup title={t('settingsHome.basics')} description={t('settingsHome.configRequiredDescription')}>
 <GroupedCard>
 {showConfigTab ? (
 <NavigationRow
 icon={FileCog}
 title={t('mainTabs.config')}
 detail={t('settingsHome.config.detail')}
 onClick={() => onOpenPage('config')}
 />
 ) : null}
 {showMcpTab ? (
 <NavigationRow
 icon={Server}
 title={t('mcpConfig.title')}
 detail={t('settingsHome.mcp.detail')}
 onClick={() => onOpenPage('mcp')}
 />
 ) : null}
 </GroupedCard>
 </SettingsGroup>
 ) : null}

 {IS_SAAS_MODE ? (
 <SettingsGroup
 title={t('fileStorage.sectionTitle')}
 description={t('fileStorage.sectionDescription')}
 >
 <GroupedCard>
 <FileStorageSettingsSection />
 </GroupedCard>
 </SettingsGroup>
 ) : null}

 <SettingsGroup title={t('settingsHome.application')}>
 <GroupedCard divided>
 {IS_SAAS_MODE ? (
 <div className="px-4 py-3">
 <ProjectContinuitySettingsRow />
 </div>
 ) : null}
<MenuRow
 icon={Palette}
 title={t('settingsHome.appearanceMode.title')}
 detail={t('settingsHome.appearanceMode.detail')}
 >
 <SelectControl
 value={themeMode}
 onChange={(value) => setThemeMode?.(value as ThemeMode)}
 options={[
 { value: 'system', label: t('settingsHome.appearanceMode.system') },
 { value: 'light', label: t('settingsHome.appearanceMode.light') },
 { value: 'dark', label: t('settingsHome.appearanceMode.dark') },
 ]}
 className="w-40"
 />
 </MenuRow>
 <MenuRow
 icon={Globe2}
 title={t('account.languageLabel')}
 detail={t('account.languageDescription')}
 >
 <SelectControl
 value={currentLanguage}
 onChange={(value) => void i18n.changeLanguage(value)}
 options={languages.map((language) => ({
 value: language.value,
 label: language.nativeName,
 }))}
 className="w-40"
 />
 </MenuRow>
 <MenuRow
 icon={ArrowUpDown}
 title={t('appearanceSettings.projectSorting.label')}
 detail={t('appearanceSettings.projectSorting.description')}
 >
 <SelectControl
 value={projectSortOrder}
 onChange={(value) => onProjectSortOrderChange(value as ProjectSortOrder)}
 options={[
 { value: 'name', label: t('appearanceSettings.projectSorting.alphabetical') },
 { value: 'date', label: t('appearanceSettings.projectSorting.recentActivity') },
 ]}
 className="w-44"
 />
 </MenuRow>
 <div className="px-5 py-3">
 <DesignCanvasSettingsRow />
 </div>
 </GroupedCard>
 </SettingsGroup>

 <SettingsGroup title={t('settingsHome.workflow')}>
 <GroupedCard divided>
 <NavigationRow
 icon={MessageSquare}
 title={t('settingsHome.chatInput.title')}
 detail={t('settingsHome.chatInput.detail')}
 onClick={() => onOpenPage('chatInput')}
 />
 <NavigationRow
 icon={Code2}
 title={t('appearanceSettings.codeEditor.title')}
 detail={t('settingsHome.codeEditor.detail')}
 onClick={() => onOpenPage('codeEditor')}
 />
 </GroupedCard>
 </SettingsGroup>

 {showAdvanced ? (
 <SettingsGroup title={t('settingsHome.advanced')}>
 <GroupedCard divided>
 <NavigationRow
 icon={Shield}
 title={t('mainTabs.permissions')}
 detail={t('settingsHome.permissions.detail')}
 onClick={() => onOpenPage('permissions')}
 />
 <TelemetrySettingsRow />
 </GroupedCard>
 </SettingsGroup>
 ) : null}

 {showAbout ? <NovaAboutSection /> : null}
 </div>
 );
}

function ChatInputSettingsPage() {
 const { t } = useTranslation('settings');
 const { preferences, setPreference } = useUiPreferences();

 return (
 <div className="space-y-8">
 <SettingsSection title={t('quickSettings.sections.toolDisplay')}>
 <SettingsCard divided>
 <SettingsRow label={t('quickSettings.autoExpandTools')}>
 <SettingsToggle
 checked={preferences.autoExpandTools}
 onChange={(value) => setPreference('autoExpandTools', value)}
 ariaLabel={t('quickSettings.autoExpandTools')}
 />
 </SettingsRow>
 <SettingsRow label={t('quickSettings.showRawParameters')}>
 <SettingsToggle
 checked={preferences.showRawParameters}
 onChange={(value) => setPreference('showRawParameters', value)}
 ariaLabel={t('quickSettings.showRawParameters')}
 />
 </SettingsRow>
 <SettingsRow label={t('quickSettings.showThinking')}>
 <SettingsToggle
 checked={preferences.showThinking}
 onChange={(value) => setPreference('showThinking', value)}
 ariaLabel={t('quickSettings.showThinking')}
 />
 </SettingsRow>
 <SettingsRow label={t('quickSettings.processDetailLevel')}>
 <SelectControl
 value={preferences.processDetailLevel}
 onChange={(value) => setPreference('processDetailLevel', value as ProcessDetailLevel)}
 options={[
 { value: 'minimal', label: t('quickSettings.processDetailMinimal') },
 { value: 'standard', label: t('quickSettings.processDetailStandard') },
 { value: 'detailed', label: t('quickSettings.processDetailDetailed') },
 ]}
 />
 </SettingsRow>
 </SettingsCard>
 </SettingsSection>

 <SettingsSection title={t('quickSettings.sections.viewOptions')}>
 <SettingsCard>
 <SettingsRow label={t('quickSettings.autoScrollToBottom')}>
 <SettingsToggle
 checked={preferences.autoScrollToBottom}
 onChange={(value) => setPreference('autoScrollToBottom', value)}
 ariaLabel={t('quickSettings.autoScrollToBottom')}
 />
 </SettingsRow>
 </SettingsCard>
 </SettingsSection>

 <SettingsSection title={t('quickSettings.sections.inputSettings')}>
 <SettingsCard>
 <SettingsRow
 label={t('quickSettings.sendByCtrlEnter')}
 description={t('quickSettings.sendByCtrlEnterDescription')}
 >
 <SettingsToggle
 checked={preferences.sendByCtrlEnter}
 onChange={(value) => setPreference('sendByCtrlEnter', value)}
 ariaLabel={t('quickSettings.sendByCtrlEnter')}
 />
 </SettingsRow>
 </SettingsCard>
 </SettingsSection>
 </div>
 );
}

type CodeEditorSettingsPageProps = {
 settings: CodeEditorSettingsState;
 onWordWrapChange: (value: boolean) => void;
 onShowMinimapChange: (value: boolean) => void;
 onLineNumbersChange: (value: boolean) => void;
 onFontSizeChange: (value: string) => void;
};

function CodeEditorSettingsPage({
 settings,
 onWordWrapChange,
 onShowMinimapChange,
 onLineNumbersChange,
 onFontSizeChange,
}: CodeEditorSettingsPageProps) {
 const { t } = useTranslation('settings');

 return (
 <div className="space-y-8">
 <SettingsSection title={t('appearanceSettings.codeEditor.title')}>
 <SettingsCard divided>
 <SettingsRow
 label={t('appearanceSettings.codeEditor.wordWrap.label')}
 description={t('appearanceSettings.codeEditor.wordWrap.description')}
 >
 <SettingsToggle
 checked={settings.wordWrap}
 onChange={onWordWrapChange}
 ariaLabel={t('appearanceSettings.codeEditor.wordWrap.label')}
 />
 </SettingsRow>
 <SettingsRow
 label={t('appearanceSettings.codeEditor.showMinimap.label')}
 description={t('appearanceSettings.codeEditor.showMinimap.description')}
 >
 <SettingsToggle
 checked={settings.showMinimap}
 onChange={onShowMinimapChange}
 ariaLabel={t('appearanceSettings.codeEditor.showMinimap.label')}
 />
 </SettingsRow>
 <SettingsRow
 label={t('appearanceSettings.codeEditor.lineNumbers.label')}
 description={t('appearanceSettings.codeEditor.lineNumbers.description')}
 >
 <SettingsToggle
 checked={settings.lineNumbers}
 onChange={onLineNumbersChange}
 ariaLabel={t('appearanceSettings.codeEditor.lineNumbers.label')}
 />
 </SettingsRow>
 <SettingsRow
 label={t('appearanceSettings.codeEditor.fontSize.label')}
 description={t('appearanceSettings.codeEditor.fontSize.description')}
 >
 <SelectControl
 value={settings.fontSize}
 onChange={onFontSizeChange}
 options={['10', '11', '12', '13', '14', '15', '16', '18', '20'].map((size) => ({
 value: size,
 label: `${size}px`,
 }))}
 className="w-28"
 />
 </SettingsRow>
 </SettingsCard>
 </SettingsSection>
 </div>
 );
}

function SettingsGroup({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
 return (
 <section className="space-y-2.5">
 <div>
 <h3 className="text-[15px] font-semibold leading-5 text-foreground">{title}</h3>
 {description && (
 <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
 )}
 </div>
 {children}
 </section>
 );
}

function GroupedCard({ children, divided }: { children: ReactNode; divided?: boolean }) {
 return (
 <div
 className={cn(
 'overflow-hidden rounded-lg border border-border bg-card/60',
 divided && 'divide-y divide-border',
 )}
 >
 {children}
 </div>
 );
}

function MenuRow({
 icon: Icon,
 title,
 detail,
 children,
}: {
 icon: LucideIcon;
 title: ReactNode;
 detail: ReactNode;
 children: ReactNode;
}) {
 return (
 <div className="flex min-h-[66px] items-center gap-3.5 px-5 py-3">
 <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
 <div className="min-w-0 flex-1">
 <div className="text-[15px] font-semibold leading-5 text-foreground">{title}</div>
 <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</div>
 </div>
 <div className="flex-shrink-0">{children}</div>
 </div>
 );
}

function NavigationRow({
 icon: Icon,
 title,
 detail,
 onClick,
}: {
 icon: LucideIcon;
 title: ReactNode;
 detail: ReactNode;
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 className="flex min-h-[66px] w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-accent/35 active:bg-accent/50"
 >
 <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
 <div className="min-w-0 flex-1">
 <div className="text-[15px] font-semibold leading-5 text-foreground">{title}</div>
 <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</div>
 </div>
 <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
 </button>
 );
}

function SelectControl({
 value,
 onChange,
 options,
 className,
}: {
 value: string;
 onChange: (value: string) => void;
 options: Array<{ value: string; label: string }>;
 className?: string;
}) {
 return (
 <select
 value={value}
 onChange={(event) => onChange(event.target.value)}
 className={cn(
 'h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground outline-none transition-colors',
 'hover:bg-accent focus:border-ring focus:ring-1 focus:ring-ring',
 '[color-scheme:light] dark:[color-scheme:dark]',
 className,
 )}
 >
 {options.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 );
}

export default Settings;
