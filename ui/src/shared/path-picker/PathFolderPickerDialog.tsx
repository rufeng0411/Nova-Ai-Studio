// PD-SAAS-FORK: path folder picker for OSS project wizard
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { Button, Input } from '../view/ui';
import { isImeEnterEvent } from '../../utils/ime';
import { cn } from '../../lib/utils.js';
import {
  BROWSE_ROOTS_TOKEN,
  buildPathBreadcrumbs,
  getParentPath,
  joinFolderPath,
  normalizePathInput,
} from './pathNormalize';
import {
  browseFilesystemFolders,
  createFileInFilesystem,
  createFolderInFilesystem,
  ensureFilesystemPath,
  type FolderSuggestion,
} from './pathPickerApi';
import { readRecentPaths } from './recentPaths';

export type PathFolderPickerMode = 'existing' | 'new';

type PathFolderPickerDialogProps = {
  isOpen: boolean;
  initialPath?: string;
  mode: PathFolderPickerMode;
  autoAdvanceOnSelect: boolean;
  onClose: () => void;
  onFolderSelected: (folderPath: string, advanceToConfirm: boolean) => void;
};

export default function PathFolderPickerDialog({
  isOpen,
  initialPath = '',
  mode,
  autoAdvanceOnSelect,
  onClose,
  onFolderSelected,
}: PathFolderPickerDialogProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(BROWSE_ROOTS_TOKEN);
  const [pathInput, setPathInput] = useState('');
  const [browseKind, setBrowseKind] = useState<'roots' | 'directory'>('roots');
  const [folders, setFolders] = useState<FolderSuggestion[]>([]);
  const [quickRoots, setQuickRoots] = useState<FolderSuggestion[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showHiddenFolders, setShowHiddenFolders] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCreateHint, setPendingCreateHint] = useState(false);

  const recentPaths = useMemo(() => readRecentPaths(), [isOpen]);

  const loadFolders = useCallback(async (pathToLoad: string) => {
    setLoadingFolders(true);
    setError(null);
    setPendingCreateHint(false);

    try {
      const result = await browseFilesystemFolders(pathToLoad);
      setCurrentPath(result.path);
      setPathInput(result.path);
      setBrowseKind(result.kind === 'roots' ? 'roots' : 'directory');
      if (result.kind === 'roots') {
        setQuickRoots(result.suggestions);
        setFolders([]);
      } else {
        setFolders(result.suggestions);
      }
    } catch (loadError) {
      if (mode === 'new' && pathToLoad !== BROWSE_ROOTS_TOKEN) {
        setPathInput(pathToLoad);
        setCurrentPath(pathToLoad);
        setPendingCreateHint(true);
        setFolders([]);
        setBrowseKind('directory');
      } else {
        setError(loadError instanceof Error ? loadError.message : t('projectWizard.folderBrowser.pathNotFound'));
      }
    } finally {
      setLoadingFolders(false);
    }
  }, [mode, t]);

  useEffect(() => {
    if (!isOpen) return;
    const startPath = normalizePathInput(initialPath) || BROWSE_ROOTS_TOKEN;
    void loadFolders(startPath);
  }, [initialPath, isOpen, loadFolders]);

  const visibleFolders = useMemo(
    () =>
      folders
        .filter((folder) => showHiddenFolders || !folder.name.startsWith('.'))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [folders, showHiddenFolders],
  );

  const breadcrumbs = useMemo(() => {
    const items = buildPathBreadcrumbs(currentPath);
    return items.map((item) => ({
      ...item,
      label: item.path === BROWSE_ROOTS_TOKEN
        ? t('projectWizard.folderBrowser.rootsLabel')
        : item.label,
    }));
  }, [currentPath, t]);

  const resetCreateInputs = () => {
    setShowNewFolderInput(false);
    setShowNewFileInput(false);
    setNewFolderName('');
    setNewFileName('');
  };

  const handleClose = () => {
    setError(null);
    resetCreateInputs();
    onClose();
  };

  const navigateTo = useCallback((nextPath: string) => {
    void loadFolders(nextPath);
  }, [loadFolders]);

  const handleGoToPath = useCallback(() => {
    const normalized = normalizePathInput(pathInput);
    if (!normalized) return;
    void loadFolders(normalized);
  }, [loadFolders, pathInput]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || currentPath === BROWSE_ROOTS_TOKEN) return;

    setCreatingFolder(true);
    setError(null);
    try {
      const folderPath = joinFolderPath(currentPath, newFolderName);
      const createdPath = await createFolderInFilesystem(folderPath);
      resetCreateInputs();
      await loadFolders(createdPath);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('projectWizard.errors.failedToCreateFolder'));
    } finally {
      setCreatingFolder(false);
    }
  }, [currentPath, loadFolders, newFolderName, t]);

  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim() || currentPath === BROWSE_ROOTS_TOKEN) return;

    setCreatingFile(true);
    setError(null);
    try {
      await createFileInFilesystem(currentPath, newFileName.trim(), '');
      resetCreateInputs();
      await loadFolders(currentPath);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('projectWizard.errors.failedToCreateFolder'));
    } finally {
      setCreatingFile(false);
    }
  }, [currentPath, loadFolders, newFileName, t]);

  const selectFolderPath = useCallback(async (folderPath: string, advanceToConfirm: boolean) => {
    const targetPath = normalizePathInput(folderPath);
    if (!targetPath || targetPath === BROWSE_ROOTS_TOKEN) return;

    setConfirming(true);
    setError(null);
    try {
      if (mode === 'new') {
        const ensured = await ensureFilesystemPath(targetPath, true);
        onFolderSelected(ensured.path, advanceToConfirm);
      } else {
        await ensureFilesystemPath(targetPath, false);
        onFolderSelected(targetPath, advanceToConfirm);
      }
      resetCreateInputs();
      onClose();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : t('projectWizard.folderBrowser.pathNotFound'));
    } finally {
      setConfirming(false);
    }
  }, [mode, onClose, onFolderSelected, t]);

  const handleConfirm = useCallback(async () => {
    await selectFolderPath(pathInput || currentPath, autoAdvanceOnSelect);
  }, [autoAdvanceOnSelect, currentPath, pathInput, selectFolderPath]);

  const parentPath = getParentPath(currentPath);
  const sidebarItems = browseKind === 'roots' ? quickRoots : [];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        data-testid="path-folder-picker-dialog"
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card text-card-foreground shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {t('projectWizard.folderBrowser.title')}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHiddenFolders((previous) => !previous)}
              className={cn(
                'rounded-md p-2 transition-colors',
                showHiddenFolders
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={
                showHiddenFolders
                  ? t('projectWizard.folderBrowser.hideHidden')
                  : t('projectWizard.folderBrowser.showHidden')
              }
            >
              {showHiddenFolders ? (
                <Eye className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <EyeOff className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFileInput(false);
                setShowNewFolderInput((previous) => !previous);
              }}
              className={cn(
                'rounded-md p-2 transition-colors',
                showNewFolderInput
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={t('projectWizard.folderBrowser.createNewFolder')}
            >
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t('buttons.close')}
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isImeEnterEvent(event)) {
                  handleGoToPath();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleGoToPath} disabled={loadingFolders}>
              {t('projectWizard.folderBrowser.go')}
            </Button>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto text-xs">
            {breadcrumbs.map((crumb) => (
              <button
                key={crumb.path}
                type="button"
                onClick={() => navigateTo(crumb.path)}
                className="shrink-0 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {crumb.label}
              </button>
            ))}
          </div>
        </div>

        {(showNewFolderInput || showNewFileInput) && browseKind === 'directory' ? (
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            {showNewFolderInput ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder={t('projectWizard.folderBrowser.newFolderName')}
                  className="flex-1"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isImeEnterEvent(event)) {
                      void handleCreateFolder();
                    }
                    if (event.key === 'Escape') {
                      resetCreateInputs();
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => void handleCreateFolder()}
                  disabled={!newFolderName.trim() || creatingFolder}
                >
                  {creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : t('projectWizard.folderBrowser.create')}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetCreateInputs}>
                  {t('projectWizard.folderBrowser.cancel')}
                </Button>
              </div>
            ) : null}
            {showNewFileInput ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newFileName}
                  onChange={(event) => setNewFileName(event.target.value)}
                  placeholder={t('projectWizard.folderBrowser.newFileName')}
                  className="flex-1"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isImeEnterEvent(event)) {
                      void handleCreateFile();
                    }
                    if (event.key === 'Escape') {
                      resetCreateInputs();
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => void handleCreateFile()}
                  disabled={!newFileName.trim() || creatingFile}
                >
                  {creatingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : t('projectWizard.folderBrowser.create')}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetCreateInputs}>
                  {t('projectWizard.folderBrowser.cancel')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="px-4 pt-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        {pendingCreateHint ? (
          <div className="px-4 pt-3">
            <p className="text-sm text-muted-foreground">{t('projectWizard.folderBrowser.willCreateOnConfirm')}</p>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-44 shrink-0 border-r border-border bg-muted/30 p-3 sm:block md:w-48">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {t('projectWizard.folderBrowser.quickAccess')}
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => navigateTo(BROWSE_ROOTS_TOKEN)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {t('projectWizard.folderBrowser.thisPc')}
              </button>
              {recentPaths.map((recentPath) => (
                <button
                  key={recentPath}
                  type="button"
                  onClick={() => navigateTo(recentPath)}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title={recentPath}
                >
                  {recentPath}
                </button>
              ))}
              {sidebarItems.map((item) => (
                <button
                  key={`${item.kind || 'root'}-${item.path}`}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  title={item.path}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1">
                {parentPath && browseKind === 'directory' ? (
                  <button
                    type="button"
                    onClick={() => navigateTo(parentPath)}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground"
                  >
                    <FolderOpen className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                    <span className="font-medium text-foreground">..</span>
                    <span className="text-xs text-muted-foreground">{t('projectWizard.folderBrowser.parent')}</span>
                  </button>
                ) : null}

                {browseKind === 'roots'
                  ? quickRoots.map((folder) => (
                    <div key={`${folder.kind || 'item'}-${folder.path}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigateTo(folder.path)}
                        className="flex flex-1 items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground"
                      >
                        <FolderPlus className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                        <span className="font-medium text-foreground">{folder.name}</span>
                      </button>
                      {folder.path !== BROWSE_ROOTS_TOKEN ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void selectFolderPath(folder.path, autoAdvanceOnSelect)}
                          className="px-3 text-xs"
                        >
                          {t('projectWizard.folderBrowser.select')}
                        </Button>
                      ) : null}
                    </div>
                  ))
                  : null}

                {browseKind === 'directory' && visibleFolders.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('projectWizard.folderBrowser.noSubfolders')}
                  </div>
                ) : null}

                {browseKind === 'directory'
                  ? visibleFolders.map((folder) => (
                    <div key={folder.path} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigateTo(folder.path)}
                        onDoubleClick={() => navigateTo(folder.path)}
                        className="flex flex-1 items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground"
                      >
                        <FolderPlus className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                        <span className="font-medium text-foreground">{folder.name}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void selectFolderPath(folder.path, autoAdvanceOnSelect)}
                        className="px-3 text-xs"
                      >
                        {t('projectWizard.folderBrowser.select')}
                      </Button>
                    </div>
                  ))
                  : null}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="flex flex-wrap gap-2">
              {browseKind === 'directory' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewFileInput(false);
                      setShowNewFolderInput(true);
                    }}
                  >
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                    {t('projectWizard.folderBrowser.createNewFolder')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setShowNewFileInput(true);
                    }}
                  >
                    <FilePlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                    {t('projectWizard.folderBrowser.createNewFile')}
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('projectWizard.folderBrowser.cancel')}
              </Button>
              <Button
                onClick={() => void handleConfirm()}
                disabled={confirming || currentPath === BROWSE_ROOTS_TOKEN}
              >
                {confirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('projectWizard.folderBrowser.useThisFolder')
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
