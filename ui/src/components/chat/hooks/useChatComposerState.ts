import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
  TouchEvent,
} from 'react';
import { useDropzone } from 'react-dropzone';
import { authenticatedFetch } from '../../../utils/api';
import { DISABLE_LOCAL_AUTH } from '../../../constants/config';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { thinkingModes } from '../constants/thinkingModes';
import { grantPilotDeckToolPermission, shouldAutoApproveSessionToolPermission, buildPilotDeckToolPermissionEntry, formatToolInputForDisplay } from '../utils/chatPermissions';
import { getPilotDeckSettings, safeLocalStorage } from '../utils/chatStorage';
import {
  createTemporarySessionId,
  getNotificationSessionSummary,
  isTemporarySessionId,
  startSessionCommand,
} from '../utils/sessionLauncher';
import {
  resolveAbortTargetSessionId,
} from '../../../shared/resolveAbortTargetSessionId';
import {
  clearAllPendingCapability,
  readPendingCapabilityContext,
} from '../../../shared/capabilityPromptInjection';
import {
  resolveCapabilityContextForSend,
} from '../../../shared/capabilitySessionBinding';
import {
  appendLaunchContextToMessage,
  clearPendingLaunchContext,
  readPendingLaunchContext,
  reconcilePendingLaunchContextForIntent,
} from '../../../shared/launchContextStorage';
import { detectPreflightDesignIntent, interceptComposerPreflightDesign } from '../../../shared/preflightDesignIntent';
import { isN2BotHudEnabled } from '../../../shared/runtimeFeatureFlags';
import { isNovaWakePhraseOnly } from '../../../saas/n2-bot/wakePhrase';
import {
  isElicitationDecisionPayload,
  isInteractiveElicitationToolName,
} from '../../../shared/pendingElicitation';
import { formatElicitationAnswersMarkdown } from '../../../shared/elicitationDisplay';
import type {
  ChatMessage,
  PendingPermissionRequest,
  PermissionMode,
} from '../types/types';
import type {
  Project,
  ProjectSession,
} from '../../../types/app';
import { escapeRegExp } from '../utils/chatFormatting';
import { isImeEnterEvent } from '../../../utils/ime';
import { useFileMentions } from './useFileMentions';
import i18n from '../../../i18n/config';
import {
  buildReferenceIntentNote,
  normalizeReferencePath,
} from '../../../shared/fileReferenceComposer';
import { pathsToReferenceAttachments } from '../../../shared/referenceMaterials';
import { registerFileReferenceHandler } from '../../../shared/fileReferenceBridge';
import { shouldRestoreProjectDraft, resolveComposerInputUpdate, type ComposerInputPolicy } from '../../../shared/composerInputGuard';
import { type SlashCommand, useSlashCommands } from './useSlashCommands';

type PendingViewSession = {
  sessionId: string | null;
  startedAt: number;
};

interface UseChatComposerStateArgs {
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  model: string;
  permissionMode: PermissionMode | string;
  basePermissionMode?: PermissionMode | string;
  cycleRunMode: () => void;
  isLoading: boolean;
  canAbortSession: boolean;
  tokenBudget: Record<string, unknown> | null;
  sendMessage: (message: unknown) => void;
  sendByCtrlEnter?: boolean;
  onSessionActive?: (sessionId?: string | null) => void;
  onSessionProcessing?: (sessionId?: string | null) => void;
  onSessionActivityBump?: (
    projectName: string,
    sessionId: string,
    optimisticTitle?: string,
  ) => void;
  onInputFocusChange?: (focused: boolean) => void;
  onFileOpen?: (filePath: string, diffInfo?: unknown) => void;
  onShowSettings?: () => void;
  pendingViewSessionRef: { current: PendingViewSession | null };
  scrollToBottom: () => void;
  addMessage: (msg: ChatMessage, targetSessionId?: string | null) => void;
  clearMessages: () => void;
  rewindMessages: (count: number) => void;
  setIsLoading: (loading: boolean) => void;
  setCanAbortSession: (canAbort: boolean) => void;
  setIsAborting: (aborting: boolean) => void;
  setClaudeStatus: (status: { text: string; tokens: number; can_interrupt: boolean } | null) => void;
  setPilotDeckStatus: (status: { text: string; tokens: number; can_interrupt: boolean } | null) => void;
  setIsUserScrolledUp: (isScrolledUp: boolean) => void;
  pendingPermissionRequests: PendingPermissionRequest[];
  setPendingPermissionRequests: Dispatch<SetStateAction<PendingPermissionRequest[]>>;
}

interface MentionableFile {
  name: string;
  path: string;
}

interface CommandExecutionResult {
  type: 'builtin' | 'custom';
  action?: string;
  data?: any;
  content?: string;
  hasBashCommands?: boolean;
  hasFileIncludes?: boolean;
  // Set by /api/commands/execute for bundled-skill stubs and on-disk
  // SKILL.md commands. When passthrough=true, the frontend re-submits the
  // raw `/<name> <args>` text as user input so the agent's SkillTool runs it.
  metadata?: {
    type?: string;
    passthrough?: boolean;
    [key: string]: unknown;
  };
  command?: string;
}

const createFakeSubmitEvent = () => {
  return { preventDefault: () => undefined } as unknown as FormEvent<HTMLFormElement>;
};

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

type UploadedAttachmentFile = {
  name: string;
  path: string;
  size?: number;
  mimeType?: string;
};

export function isComposerSocketReady(
  isConnected: boolean,
  wsReadyState: number | undefined,
): boolean {
  return isConnected || wsReadyState === WebSocket.OPEN;
}

export function shouldCycleRunModeOnKeyDown(
  event: Pick<KeyboardEvent<HTMLTextAreaElement>, 'key' | 'shiftKey'>,
  {
    showFileDropdown,
    showCommandMenu,
  }: {
    showFileDropdown: boolean;
    showCommandMenu: boolean;
  },
): boolean {
  return event.key === 'Tab' && event.shiftKey && !showFileDropdown && !showCommandMenu;
}

function buildAttachmentPathNote(files: UploadedAttachmentFile[]): string {
  if (!files.length) {
    return '';
  }

  const lines = files.map((file) => `- ${file.name}: ${file.path}`);
  return `\n\n[Files attached by user and available for reading in the project:]\n${lines.join('\n')}`;
}

function fileMentionsToAttachmentFiles(paths: string[]): UploadedAttachmentFile[] {
  return pathsToReferenceAttachments(paths);
}

function resolveComposerReferencePaths(mentionPaths: string[]): string[] {
  return uniqueReferencePaths(mentionPaths).slice(0, 6);
}

function uniqueReferencePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of paths) {
    const path = normalizeReferencePath(raw);
    if (!path.includes('/') || /\s/.test(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(path);
  }
  return ordered;
}

function mergeAttachmentFiles(
  primary: UploadedAttachmentFile[],
  extra: UploadedAttachmentFile[],
): UploadedAttachmentFile[] {
  const merged = [...primary];
  const seen = new Set(primary.map((file) => file.path.replace(/\\/g, '/').toLowerCase()));
  for (const file of extra) {
    const key = file.path.replace(/\\/g, '/').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }
  return merged;
}

export function useChatComposerState({
  selectedProject,
  selectedSession,
  currentSessionId,
  model,
  permissionMode,
  basePermissionMode,
  cycleRunMode,
  isLoading,
  canAbortSession,
  tokenBudget,
  sendMessage,
  sendByCtrlEnter,
  onSessionActive,
  onSessionProcessing,
  onSessionActivityBump,
  onInputFocusChange,
  onFileOpen,
  onShowSettings,
  pendingViewSessionRef,
  scrollToBottom,
  addMessage,
  clearMessages,
  rewindMessages,
  setIsLoading,
  setCanAbortSession,
  setIsAborting,
  setClaudeStatus,
  setPilotDeckStatus,
  setIsUserScrolledUp,
  pendingPermissionRequests,
  setPendingPermissionRequests,
}: UseChatComposerStateArgs) {
  const { isConnected, ws } = useWebSocket();
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      return safeLocalStorage.getItem(`draft_input_${selectedProject.name}`) || '';
    }
    return '';
  });
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Map<string, number>>(new Map());
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map());
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [thinkingMode, setThinkingMode] = useState('none');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmitRef = useRef<
    ((event: FormEvent<HTMLFormElement> | MouseEvent | TouchEvent | KeyboardEvent<HTMLTextAreaElement>) => Promise<void>) | null
  >(null);
  const inputValueRef = useRef(input);

  // One-shot flag set by `handleCustomCommand` when re-submitting passthrough
  // slash content (e.g. `/projects` for bundled stubs, `/canvas` for skills).
  // Without this, handleSubmit would see the leading `/`, match the command
  // again, call executeCommand, get the same passthrough back, and loop —
  // user-visibly: the input keeps deleting/refilling.
  const skipSlashDetectionOnceRef = useRef(false);
  const draftProjectNameRef = useRef<string | null>(null);
  /** True after the user types/pastes in the composer; blocks passive external overwrites. */
  const composerUserEditedRef = useRef(false);

  const applyComposerInput = useCallback((value: string, policy: ComposerInputPolicy) => {
    setInput((previous) => {
      const decision = resolveComposerInputUpdate(previous, value, policy, {
        userHasEdited: composerUserEditedRef.current,
      });
      if (!decision.apply) {
        return previous;
      }
      inputValueRef.current = decision.value;
      if (policy === 'user') {
        composerUserEditedRef.current = true;
      } else if (policy === 'intent' || policy === 'restore') {
        composerUserEditedRef.current = false;
      }
      return decision.value;
    });
  }, []);

  const applyExternalComposerInput = useCallback(
    (value: string) => applyComposerInput(value, 'external'),
    [applyComposerInput],
  );

  const handleBuiltInCommand = useCallback(
    async (result: CommandExecutionResult) => {
      const { action, data } = result;
      switch (action) {
        case 'clear':
          clearMessages();
          break;

        case 'help':
          addMessage({
            type: 'assistant',
            content: data.content,
            timestamp: Date.now(),
          });
          break;

        case 'model': {
          const modelLines = [`**Current Model**: ${data.current.model}`, '', '**Available Models**:'];
          if (data.available && typeof data.available === 'object') {
            for (const [provider, models] of Object.entries(data.available)) {
              if (Array.isArray(models) && models.length) {
                modelLines.push('', `${provider}: ${models.join(', ')}`);
              }
            }
          }
          addMessage({
            type: 'assistant',
            content: modelLines.join('\n'),
            timestamp: Date.now(),
          });
          break;
        }

        case 'cost': {
          const costMessage = `**Token Usage**: ${data.tokenUsage.used.toLocaleString()} / ${data.tokenUsage.total.toLocaleString()} (${data.tokenUsage.percentage}%)\n\n**Estimated Cost**:\n- Input: $${data.cost.input}\n- Output: $${data.cost.output}\n- **Total**: $${data.cost.total}\n\n**Model**: ${data.model}`;
          addMessage({ type: 'assistant', content: costMessage, timestamp: Date.now() });
          break;
        }

        case 'status': {
          const statusMessage = `**System Status**\n\n- Version: ${data.version}\n- Uptime: ${data.uptime}\n- Model: ${data.model}\n- Provider: ${data.provider}\n- Node.js: ${data.nodeVersion}\n- Platform: ${data.platform}`;
          addMessage({ type: 'assistant', content: statusMessage, timestamp: Date.now() });
          break;
        }

        case 'memory':
          if (data.error) {
            addMessage({
              type: 'assistant',
              content: `Warning: ${data.message}`,
              timestamp: Date.now(),
            });
          } else {
            addMessage({
              type: 'assistant',
              content: `${data.message}\n\nPath: \`${data.path}\``,
              timestamp: Date.now(),
            });
            if (data.exists && onFileOpen) {
              onFileOpen(data.path);
            }
          }
          break;

        case 'config':
          onShowSettings?.();
          break;

        case 'rewind':
          if (data.error) {
            addMessage({
              type: 'assistant',
              content: `Warning: ${data.message}`,
              timestamp: Date.now(),
            });
          } else {
            rewindMessages(data.steps * 2);
            addMessage({
              type: 'assistant',
              content: `Rewound ${data.steps} step(s). ${data.message}`,
              timestamp: Date.now(),
            });
          }
          break;

        case 'skillInstall': {
          if (data.error) {
            addMessage({
              type: 'assistant',
              content: `**Skill install failed**\n\n${data.message || data.errorMessage || 'Unknown error'}${
                data.stderr ? `\n\n\`\`\`\n${data.stderr}\n\`\`\`` : ''
              }`,
              timestamp: Date.now(),
            });
            break;
          }
          const lines: string[] = [];

          if (data.needsForce) {
            lines.push(
              `⚠️ **\`${data.slug}\` is flagged as suspicious by VirusTotal.** clawhub refused to install without explicit consent.`,
            );
            lines.push('');
            lines.push('Review the skill before retrying. If you trust the source, rerun:');
            lines.push('');
            lines.push('```');
            lines.push(data.retryCommand || `/skill_install ${data.slug} --force`);
            lines.push('```');
          } else if (data.installed) {
            const versionTag = data.skillMeta?.version ? ` v${data.skillMeta.version}` : '';
            const displayName = data.skillMeta?.name || data.slug;
            lines.push(`✅ **Installed** \`${displayName}\`${versionTag} (${data.scope === 'project' ? 'project' : 'user'} scope)`);
            lines.push(`Path: \`${data.installPath}\``);
            if (data.skillMeta?.description) {
              lines.push('');
              lines.push(data.skillMeta.description);
            }
          } else {
            lines.push(
              `⚠️ clawhub finished but \`SKILL.md\` was not found at \`${data.installPath}\`.`,
            );
          }

          if (data.stdout) {
            lines.push('');
            lines.push('```');
            lines.push(data.stdout);
            lines.push('```');
          }
          if (data.stderr) {
            lines.push('');
            lines.push('**stderr**');
            lines.push('```');
            lines.push(data.stderr);
            lines.push('```');
          }
          if (data.exitCode && data.exitCode !== 0 && !data.needsForce) {
            lines.push('');
            lines.push(`Exit code: \`${data.exitCode}\`. ${data.errorMessage || ''}`);
          }
          if (data.installed) {
            lines.push('');
            lines.push('_New skill is on disk — open a fresh chat (or `/clear-caches`) to make Nova Ai-Studio see it. The UI slash menu picks it up next time you open `/`._');
          }
          addMessage({
            type: 'assistant',
            content: lines.join('\n'),
            timestamp: Date.now(),
          });
          break;
        }

        case 'switchProject': {
          // The server validates that an arg was supplied; project lookup
          // happens here because the client already holds the projects list.
          // window.switchProject is registered by AppShellV2 and returns
          // false when no project matches, letting us surface a helpful
          // "not found" message in chat without leaving the page.
          if (data.error) {
            addMessage({
              type: 'assistant',
              content: data.message,
              timestamp: Date.now(),
            });
            break;
          }
          const targetName = String(data.projectName ?? '').trim();
          const switched =
            typeof window !== 'undefined' && typeof window.switchProject === 'function'
              ? window.switchProject(targetName)
              : false;
          addMessage({
            type: 'assistant',
            content: switched
              ? `Switched to project: \`${targetName}\``
              : `No project matched \`${targetName}\`. Try the project's directory name (sidebar tooltip).`,
            timestamp: Date.now(),
          });
          break;
        }

        default:
          console.warn('Unknown built-in command action:', action);
      }
    },
    [
      onFileOpen,
      onShowSettings,
      addMessage,
      clearMessages,
      rewindMessages,
    ],
  );

  const handleCustomCommand = useCallback(async (result: CommandExecutionResult) => {
    const { content, hasBashCommands, metadata } = result;

    if (hasBashCommands) {
      const confirmed = window.confirm(
        'This command contains bash commands that will be executed. Do you want to proceed?',
      );
      if (!confirmed) {
        addMessage({
          type: 'assistant',
          content: 'Command execution cancelled',
          timestamp: Date.now(),
        });
        return;
      }
    }

    const commandContent = content || '';
    setInput(commandContent);
    inputValueRef.current = commandContent;

    // Passthrough commands (bundled-skill stubs, on-disk skills) return their
    // own slash text as `content`. Suppress the next handleSubmit's slash
    // re-detection, otherwise it loops: detect /, executeCommand, passthrough,
    // setInput, submit, detect /, ... See skipSlashDetectionOnceRef.
    if (metadata && (metadata as { passthrough?: unknown }).passthrough) {
      skipSlashDetectionOnceRef.current = true;
    }

    // Defer submit to next tick so the command text is reflected in UI before dispatching.
    setTimeout(() => {
      if (handleSubmitRef.current) {
        handleSubmitRef.current(createFakeSubmitEvent());
      }
    }, 0);
  }, [addMessage]);

  const executeCommand = useCallback(
    async (command: SlashCommand, rawInput?: string) => {
      if (!command || !selectedProject) {
        return;
      }

      try {
        const effectiveInput = rawInput ?? input;
        const commandMatch = effectiveInput.match(new RegExp(`${escapeRegExp(command.name)}\\s*(.*)`));
        const args =
          commandMatch && commandMatch[1] ? commandMatch[1].trim().split(/\s+/) : [];

        const context = {
          projectPath: selectedProject.fullPath || selectedProject.path,
          projectName: selectedProject.name,
          sessionId: currentSessionId,
          model,
          tokenUsage: tokenBudget,
        };

        const response = await authenticatedFetch('/api/commands/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commandName: command.name,
            commandPath: command.path,
            args,
            context,
          }),
        });

        if (!response.ok) {
          let errorMessage = `Failed to execute command (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData?.message || errorData?.error || errorMessage;
          } catch {
            // Ignore JSON parse failures and use fallback message.
          }
          throw new Error(errorMessage);
        }

        const result = (await response.json()) as CommandExecutionResult;
        if (result.type === 'builtin') {
          await handleBuiltInCommand(result);
          setInput('');
          inputValueRef.current = '';
        } else if (result.type === 'custom') {
          await handleCustomCommand(result);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error executing command:', error);
        addMessage({
          type: 'assistant',
          content: `Error executing command: ${message}`,
          timestamp: Date.now(),
        });
      }
    },
    [
      model,
      currentSessionId,
      handleBuiltInCommand,
      handleCustomCommand,
      input,
      selectedProject,
      addMessage,
      tokenBudget,
    ],
  );

  const {
    slashCommands,
    slashCommandsCount,
    filteredCommands,
    frequentCommands,
    commandQuery,
    showCommandMenu,
    selectedCommandIndex,
    resetCommandMenuState,
    dismissCommandMenu,
    handleCommandSelect,
    handleToggleCommandMenu,
    handleCommandInputChange,
    handleCommandMenuKeyDown,
  } = useSlashCommands({
    selectedProject,
    input,
    setInput,
    textareaRef,
    onExecuteCommand: executeCommand,
    inputValueRef,
    handleSubmitRef,
  });

  const {
    showFileDropdown,
    filteredFiles,
    selectedFileIndex,
    activeFileMentionPaths,
    selectFile,
    addFileReferences,
    setPromptWithReferences,
    removeFileReference,
    clearFileMentions,
    applyIntentComposerInput,
    setCursorPosition,
    handleFileMentionsKeyDown,
  } = useFileMentions({
    selectedProject,
    input,
    setInput,
    applyIntentComposerInput: (value) => applyComposerInput(value, 'intent'),
    textareaRef,
  });

  useEffect(() => {
    registerFileReferenceHandler(addFileReferences);
    return () => registerFileReferenceHandler(null);
  }, [addFileReferences]);

  const handleImageFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => {
      try {
        if (!file || typeof file !== 'object') {
          console.warn('Invalid file object:', file);
          return false;
        }

        if (typeof file.size !== 'number' || file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          const fileName = file.name || 'Unknown file';
          setImageErrors((previous) => {
            const next = new Map(previous);
            next.set(fileName, 'File too large (max 20MB)');
            return next;
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error validating file:', error, file);
        return false;
      }
    });

    if (validFiles.length > 0) {
      setAttachedImages((previous) => [...previous, ...validFiles].slice(0, MAX_ATTACHMENTS));
    }
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(event.clipboardData.items);

      const pastedFiles: File[] = [];

      items.forEach((item) => {
        if (item.kind !== 'file') return;
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      });

      if (pastedFiles.length > 0) {
        handleImageFiles(pastedFiles);
        event.preventDefault();
        return;
      }

      if (items.length === 0 && event.clipboardData.files.length > 0) {
        const files = Array.from(event.clipboardData.files);
        if (files.length > 0) {
          handleImageFiles(files);
          event.preventDefault();
        }
      }
    },
    [handleImageFiles],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    maxSize: MAX_ATTACHMENT_SIZE_BYTES,
    maxFiles: MAX_ATTACHMENTS,
    onDrop: handleImageFiles,
    noClick: true,
    noKeyboard: true,
  });

  const handleSubmit = useCallback(
    async (
      event: FormEvent<HTMLFormElement> | MouseEvent | TouchEvent | KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      event.preventDefault();
      const currentInput = inputValueRef.current;
      const hasAttachments = attachedImages.length > 0;
      if ((!currentInput.trim() && !hasAttachments) || isLoading || !selectedProject) {
        return;
      }

      // Intercept slash commands: if input starts with /commandName, execute as command with args.
      // Skip when handleCustomCommand just pushed a passthrough back into the
      // input box — we already executed it once and want this submit to flow
      // through as a normal user message.
      const trimmedInput = currentInput.trim();
      if (skipSlashDetectionOnceRef.current) {
        skipSlashDetectionOnceRef.current = false;
      } else if (trimmedInput.startsWith('/')) {
        const firstSpace = trimmedInput.indexOf(' ');
        const commandName = firstSpace > 0 ? trimmedInput.slice(0, firstSpace) : trimmedInput;
        const matchedCommand = slashCommands.find((cmd: SlashCommand) => cmd.name === commandName);
        if (matchedCommand) {
          executeCommand(matchedCommand, trimmedInput);
          setInput('');
          inputValueRef.current = '';
          setAttachedImages([]);
          setUploadingImages(new Map());
          setImageErrors(new Map());
          resetCommandMenuState();
          setIsTextareaExpanded(false);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
          return;
        }
      }

      const composerLocale = i18n.language === 'zh-CN' ? 'zh-CN' : i18n.language;
      if (
        interceptComposerPreflightDesign({
          message: trimmedInput,
          locale: composerLocale,
          sessionId: currentSessionId ?? selectedSession?.id ?? null,
          hasAttachments,
        })
      ) {
        setInput('');
        inputValueRef.current = '';
        resetCommandMenuState();
        setIsTextareaExpanded(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }

      // PD-SAAS-FORK: Hello Nova whole-message wake opens N2 Bot HUD, never compiles worker SDM.
      if (isN2BotHudEnabled() && isNovaWakePhraseOnly(trimmedInput) && !hasAttachments) {
        try {
          if (window.location.pathname.includes('/m')) {
            window.location.href = '/m/tools/n2-bot';
          } else {
            void import('../../../saas/n2-bot/n2BotOpen').then((mod) => {
              mod.openN2Bot();
            });
          }
        } catch {
          window.dispatchEvent(new CustomEvent('n2-bot:overlay-open'));
        }
        setInput('');
        inputValueRef.current = '';
        resetCommandMenuState();
        return;
      }

      const userVisibleInput =
        currentInput.trim() ||
        (activeFileMentionPaths.length > 0
          ? i18n.language === 'zh-CN'
            ? '请阅读我引用的文件并继续。'
            : 'Please read my referenced files and continue.'
          : 'Please review the attached file(s).');
      let messageContent = userVisibleInput;
      const selectedThinkingMode = thinkingModes.find((mode: { id: string; prefix?: string }) => mode.id === thinkingMode);
      if (selectedThinkingMode && selectedThinkingMode.prefix) {
        messageContent = `${selectedThinkingMode.prefix}: ${userVisibleInput}`;
      }

      // Pin the target session before any await so attachment upload cannot
      // race with a sidebar session switch and leak the optimistic bubble.
      const pendingSessionIdAtSubmit = pendingViewSessionRef.current?.sessionId ?? null;
      const canResumeCurrentSession =
        Boolean(currentSessionId) &&
        (Boolean(selectedSession?.id) || pendingSessionIdAtSubmit === currentSessionId);
      const submitTargetSessionId =
        selectedSession?.id ||
        (canResumeCurrentSession ? currentSessionId : null);
      const submitSelectedSession = selectedSession;

      // Optimistic sidebar refresh — fire BEFORE the attachment upload so
      // the sidebar reorders/spawns the row the instant the user clicks
      // send, not after the network round-trip. We resolve a stable
      // session id here (real id when resuming; otherwise a temporary
      // `new-session-*` placeholder that will be replaced by
      // `preserveLoadedSessions` once the server's `projects_updated`
      // arrives with the real id).
      const optimisticSessionId =
        submitTargetSessionId || createTemporarySessionId();
      if (selectedProject?.name) {
        onSessionActivityBump?.(
          selectedProject.name,
          optimisticSessionId,
          userVisibleInput,
        );
      }

      let uploadedImages: unknown[] = [];
      let uploadedFiles: UploadedAttachmentFile[] = [];
      if (attachedImages.length > 0) {
        const formData = new FormData();
        attachedImages.forEach((file) => {
          formData.append('attachments', file);
        });

        try {
          const response = await authenticatedFetch(`/api/projects/${encodeURIComponent(selectedProject.name)}/upload-attachments`, {
            method: 'POST',
            headers: {},
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to upload attachments');
          }

          const result = await response.json();
          uploadedImages = Array.isArray(result.images) ? result.images : [];
          uploadedFiles = Array.isArray(result.files) ? result.files : [];
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('Attachment upload failed:', error);
          addMessage({
            type: 'error',
            content: `Failed to upload attachments: ${message}`,
            timestamp: new Date(),
          }, submitTargetSessionId);
          return;
        }
      }

      const composerReferencePaths = resolveComposerReferencePaths(activeFileMentionPaths);
      const referenceIntentNote = buildReferenceIntentNote(
        composerReferencePaths,
        i18n.language === 'zh-CN' ? 'zh-CN' : 'en',
      );

      messageContent = `${messageContent}${referenceIntentNote}${buildAttachmentPathNote(
        mergeAttachmentFiles(uploadedFiles, fileMentionsToAttachmentFiles(composerReferencePaths)),
      )}`;

      const referencedAttachments = mergeAttachmentFiles(
        uploadedFiles,
        fileMentionsToAttachmentFiles(composerReferencePaths),
      );

      const effectiveSessionId = submitTargetSessionId;
      const sessionToActivate = effectiveSessionId || optimisticSessionId;

      if (!isComposerSocketReady(isConnected, ws?.readyState)) {
        const connectionHint = DISABLE_LOCAL_AUTH
          ? '实时连接未建立，提问无法送达。请刷新页面；若通过局域网访问，请使用本机 IP 打开（例如 http://192.168.x.x:5173），并确认已运行 dev 服务且 Gateway 已启动。'
          : '实时连接未建立。局域网访问时请在本机浏览器重新登录后再提问。';
        addMessage(
          {
            type: 'error',
            content: connectionHint,
            timestamp: new Date(),
          },
          submitTargetSessionId,
        );
        return;
      }

      const userMessage: ChatMessage = {
        type: 'user',
        content: userVisibleInput,
        images: uploadedImages as any,
        attachments: referencedAttachments.length > 0 ? (referencedAttachments as any) : undefined,
        timestamp: new Date(),
      };

      addMessage(userMessage, submitTargetSessionId);
      setIsLoading(true); // Processing banner starts
      setCanAbortSession(true);
      setClaudeStatus({
        text: 'Processing',
        tokens: 0,
        can_interrupt: true,
      });

      setIsUserScrolledUp(false);
      setTimeout(() => scrollToBottom(), 100);

      if (!effectiveSessionId && !submitSelectedSession?.id) {
        if (typeof window !== 'undefined') {
          // Reset stale pending IDs from previous interrupted runs before creating a new one.
          sessionStorage.removeItem('pendingSessionId');
        }
        pendingViewSessionRef.current = { sessionId: null, startedAt: Date.now() };
      }
      onSessionActive?.(sessionToActivate);
      if (effectiveSessionId && !isTemporarySessionId(effectiveSessionId)) {
        onSessionProcessing?.(effectiveSessionId);
      }

      // PilotDeck-only: a single localStorage entry (`pilotdeck-settings`)
      // tracks tool consent + skip-permissions for every chat. The legacy
      // per-provider keys (`cursor-tools-settings`, `codex-settings`,
      // `gemini-settings`) are no longer read or written.
      const getToolsSettings = () => {
        try {
          const savedSettings = safeLocalStorage.getItem('pilotdeck-settings');
          if (savedSettings) {
            return JSON.parse(savedSettings);
          }
        } catch (error) {
          console.error('Error loading tools settings:', error);
        }

        return getPilotDeckSettings();
      };

      const toolsSettings = getToolsSettings();
      const sessionSummary = getNotificationSessionSummary(submitSelectedSession, userVisibleInput);

      // PD-SAAS-FORK: Hub「试一下」/ 会话级技能绑定
      const pendingCapability = readPendingCapabilityContext();
      const capabilityContext = resolveCapabilityContextForSend(
        effectiveSessionId || sessionToActivate,
        pendingCapability,
        userVisibleInput,
      );
      const composerLocaleForLaunch = i18n.language === 'zh-CN' ? 'zh-CN' : i18n.language;
      const pivotIntentSlug = detectPreflightDesignIntent(userVisibleInput, composerLocaleForLaunch)?.slug ?? null;
      const launchContext = reconcilePendingLaunchContextForIntent(userVisibleInput, pivotIntentSlug);
      const messageWithLaunch = appendLaunchContextToMessage(messageContent, launchContext);

      startSessionCommand({
        sendMessage,
        selectedProject,
        command: messageWithLaunch,
        sessionId: effectiveSessionId,
        temporarySessionId: sessionToActivate,
        toolsSettings,
        permissionMode,
        basePermissionMode,
        model,
        sessionSummary,
        images: uploadedImages,
        attachments: referencedAttachments.length > 0 ? referencedAttachments : undefined,
        capabilityContext,
      });

      if (pendingCapability) {
        clearAllPendingCapability();
      }
      if (launchContext) {
        clearPendingLaunchContext();
      }

      composerUserEditedRef.current = false;
      setInput('');
      inputValueRef.current = '';
      clearFileMentions();
      resetCommandMenuState();
      setAttachedImages([]);
      setUploadingImages(new Map());
      setImageErrors(new Map());
      setIsTextareaExpanded(false);
      setThinkingMode('none');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      safeLocalStorage.removeItem(`draft_input_${selectedProject.name}`);
    },
    [
      selectedSession,
      attachedImages,
      activeFileMentionPaths,
      clearFileMentions,
      model,
      currentSessionId,
      executeCommand,
      isLoading,
      onSessionActive,
      onSessionActivityBump,
      onSessionProcessing,
      pendingViewSessionRef,
      permissionMode,
      basePermissionMode,
      resetCommandMenuState,
      scrollToBottom,
      selectedProject,
      sendMessage,
      setCanAbortSession,
      addMessage,
      setClaudeStatus,
      setPilotDeckStatus,
      setIsLoading,
      setIsUserScrolledUp,
      slashCommands,
      thinkingMode,
      isConnected,
    ],
  );

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  useEffect(() => {
    const projectName = selectedProject?.name ?? null;
    if (!shouldRestoreProjectDraft(draftProjectNameRef.current, projectName)) {
      return;
    }
    draftProjectNameRef.current = projectName;
    if (!projectName) {
      return;
    }
    const savedInput = safeLocalStorage.getItem(`draft_input_${projectName}`) || '';
    setInput((previous) => {
      const decision = resolveComposerInputUpdate(previous, savedInput, 'restore');
      if (!decision.apply) {
        return previous;
      }
      composerUserEditedRef.current = false;
      inputValueRef.current = decision.value;
      return decision.value;
    });
  }, [selectedProject?.name]);

  useEffect(() => {
    const projectName = selectedProject?.name;
    if (!projectName) {
      return;
    }
    if (input !== '') {
      safeLocalStorage.setItem(`draft_input_${projectName}`, input);
    } else {
      safeLocalStorage.removeItem(`draft_input_${projectName}`);
    }
  }, [input, selectedProject?.name]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    // Re-run when input changes so restored drafts get the same autosize behavior as typed text.
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight);
    const expanded = textareaRef.current.scrollHeight > lineHeight * 2;
    setIsTextareaExpanded(expanded);
  }, [input]);

  useEffect(() => {
    if (!textareaRef.current || input.trim()) {
      return;
    }
    textareaRef.current.style.height = 'auto';
    setIsTextareaExpanded(false);
  }, [input]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      const cursorPos = event.target.selectionStart;

      composerUserEditedRef.current = true;
      setInput(newValue);
      inputValueRef.current = newValue;
      setCursorPosition(cursorPos);

      if (!newValue.trim()) {
        event.target.style.height = 'auto';
        setIsTextareaExpanded(false);
        resetCommandMenuState();
        return;
      }

      handleCommandInputChange(newValue, cursorPos);
    },
    [handleCommandInputChange, resetCommandMenuState, setCursorPosition],
  );

  const insertAtCursor = useCallback(
    (char: string) => {
      const textarea = textareaRef.current;
      const current = inputValueRef.current ?? input;
      const selectionStart = textarea?.selectionStart ?? current.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const nextValue = `${current.slice(0, selectionStart)}${char}${current.slice(selectionEnd)}`;
      const nextCursor = selectionStart + char.length;

      setInput(nextValue);
      inputValueRef.current = nextValue;
      setCursorPosition(nextCursor);

      if (char === '/') {
        handleCommandInputChange(nextValue, nextCursor);
      }

      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        if (!node.matches(':focus')) {
          node.focus();
        }
        try {
          node.setSelectionRange(nextCursor, nextCursor);
        } catch {
          // ignore: textarea may have been unmounted between frames
        }
      });
    },
    [handleCommandInputChange, input, setCursorPosition, setInput, textareaRef],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isImeEnterEvent(event)) {
        return;
      }

      if (handleCommandMenuKeyDown(event)) {
        return;
      }

      if (handleFileMentionsKeyDown(event)) {
        return;
      }

      if (shouldCycleRunModeOnKeyDown(event, { showFileDropdown, showCommandMenu })) {
        event.preventDefault();
        cycleRunMode();
        return;
      }

      if (event.key === 'Enter') {
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
          event.preventDefault();
          handleSubmit(event);
        } else if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !sendByCtrlEnter) {
          event.preventDefault();
          handleSubmit(event);
        }
      }
    },
    [
      cycleRunMode,
      handleCommandMenuKeyDown,
      handleFileMentionsKeyDown,
      handleSubmit,
      sendByCtrlEnter,
      showCommandMenu,
      showFileDropdown,
    ],
  );

  const handleTextareaClick = useCallback(
    (event: MouseEvent<HTMLTextAreaElement>) => {
      setCursorPosition(event.currentTarget.selectionStart);
    },
    [setCursorPosition],
  );

  const handleTextareaInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      const target = event.currentTarget;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
      setCursorPosition(target.selectionStart);

      const lineHeight = parseInt(window.getComputedStyle(target).lineHeight);
      setIsTextareaExpanded(target.scrollHeight > lineHeight * 2);
    },
    [setCursorPosition],
  );

  const handleClearInput = useCallback(() => {
    setInput('');
    inputValueRef.current = '';
    resetCommandMenuState();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    setIsTextareaExpanded(false);
  }, [resetCommandMenuState]);

  const handleAbortSession = useCallback(() => {
    if (!canAbortSession) {
      return;
    }

    const pendingSessionId =
      typeof window !== 'undefined' ? sessionStorage.getItem('pendingSessionId') : null;

    const targetSessionId = resolveAbortTargetSessionId({
      currentSessionId,
      pendingViewSessionId: pendingViewSessionRef.current?.sessionId || null,
      pendingSessionIdFromStorage: pendingSessionId,
      selectedSessionId: selectedSession?.id || null,
    });

    if (!targetSessionId) {
      console.warn('Abort requested but no concrete session ID is available yet.');
      return;
    }

    sendMessage({ type: 'pause-turn', sessionId: targetSessionId, reason: 'user_pause' });

    setCanAbortSession(false);
    setIsAborting(true);
    setPilotDeckStatus({
      text: 'Stopping',
      tokens: 0,
      can_interrupt: false,
    });
  }, [canAbortSession, currentSessionId, pendingViewSessionRef, selectedSession?.id, sendMessage, setCanAbortSession, setClaudeStatus, setIsAborting, setPilotDeckStatus]);

  const handleGrantToolPermission = useCallback(
    (suggestion: { entry: string; toolName: string }) => {
      if (!suggestion) {
        return { success: false };
      }
      // adapter. After the PolitDeck-only migration every provider
      // routes through the same gateway PermissionContext, so we let
      // every provider persist its grants to localStorage and have the
      // pilotdeck server pick them up via the gateway PermissionRuntime
      // on the next turn.
      return grantPilotDeckToolPermission(suggestion.entry);
    },
    [],
  );

  const handleGrantSessionToolPermission = useCallback(
    (suggestion: { entry: string; toolName: string }) => {
      if (!suggestion?.entry) {
        return { success: false };
      }

      const sessionId = [
        selectedSession?.id,
        currentSessionId,
        pendingViewSessionRef.current?.sessionId,
      ].find((candidate) => candidate && !isTemporarySessionId(candidate));

      if (!sessionId) {
        return { success: false };
      }

      sendMessage({
        type: 'session-permission-grant',
        sessionId,
        entry: suggestion.entry,
        toolName: suggestion.toolName,
      });
      return { success: true };
    },
    [currentSessionId, pendingViewSessionRef, selectedSession?.id, sendMessage],
  );

  const handlePermissionDecision = useCallback(
    (
      requestIds: string | string[],
      decision: { allow?: boolean; message?: string; rememberEntry?: string | null; updatedInput?: unknown },
    ) => {
      const ids = Array.isArray(requestIds) ? requestIds : [requestIds];
      const validIds = ids.filter(Boolean);
      if (validIds.length === 0) {
        return;
      }

      validIds.forEach((requestId) => {
        const pending = pendingPermissionRequests.find((r) => r.requestId === requestId);
        const isElicitationFlow = Boolean(
          pending?.isElicitation
          || isInteractiveElicitationToolName(pending?.toolName)
          || isElicitationDecisionPayload(decision?.updatedInput),
        );
        if (isElicitationFlow) {
          // Elicitation flow (e.g. `ask_user_question`): submit selections
          // through GatewayElicitationBus, not GatewayPermissionBus.
          const submitted =
            (decision?.updatedInput as {
              answers?: Record<string, string | string[]>;
              annotations?: Record<string, { preview?: string; notes?: string }>;
            } | undefined) ?? {};
          const submittedAnswers = submitted.answers ?? {};
          const hasAnswers = Object.keys(submittedAnswers).length > 0;
          const questions = (pending?.input as { questions?: unknown } | undefined)?.questions;
          const sessionId = [
            pending?.sessionId,
            currentSessionId,
            selectedSession?.id,
            pendingViewSessionRef.current?.sessionId,
          ].find((candidate) => candidate && !isTemporarySessionId(candidate));

          if (decision?.allow && hasAnswers) {
            const displayText = formatElicitationAnswersMarkdown(questions, submittedAnswers);
            if (displayText.trim()) {
              addMessage(
                {
                  type: 'user',
                  content: displayText,
                  timestamp: new Date().toISOString(),
                  isElicitationReply: true,
                },
                sessionId ?? currentSessionId,
              );
              scrollToBottom();
            }
          } else if (decision?.allow && !hasAnswers) {
            addMessage(
              {
                type: 'user',
                content: i18n.t('chat:elicitation.skippedAll', { defaultValue: '已跳过作答' }),
                timestamp: new Date().toISOString(),
                isElicitationReply: true,
              },
              sessionId ?? currentSessionId,
            );
            scrollToBottom();
          }

          const answer =
            decision?.allow && hasAnswers
              ? {
                  type: 'answered' as const,
                  answers: submittedAnswers,
                  ...(submitted.annotations ? { annotations: submitted.annotations } : {}),
                }
              : {
                  type: 'cancelled' as const,
                  reason: decision?.message ?? (decision?.allow ? 'skipped' : 'declined'),
                };
          sendMessage({
            type: 'elicitation-response',
            requestId,
            answer,
          });
          return;
        }

        sendMessage({
          type: 'permission-response',
          requestId,
          allow: Boolean(decision?.allow),
          updatedInput: decision?.updatedInput,
          message: decision?.message,
          rememberEntry: decision?.rememberEntry,
        });
      });

      setPendingPermissionRequests((previous) => {
        const next = previous.filter((request) => !validIds.includes(request.requestId));
        if (next.length === 0) {
          setClaudeStatus(null);
          setPilotDeckStatus(null);
        }
        return next;
      });
    },
    [
      addMessage,
      currentSessionId,
      pendingPermissionRequests,
      pendingViewSessionRef,
      scrollToBottom,
      selectedSession?.id,
      sendMessage,
      setClaudeStatus,
      setPilotDeckStatus,
      setPendingPermissionRequests,
    ],
  );

  // PD-SAAS-FORK: skipPermissions=true → auto-allow tool prompts; zero user clicks.
  useEffect(() => {
    const pending = pendingPermissionRequests.filter((request) => shouldAutoApproveSessionToolPermission(request));
    if (pending.length === 0) return;
    for (const request of pending) {
      const rawInput = formatToolInputForDisplay(request.input);
      const rememberEntry = buildPilotDeckToolPermissionEntry(request.toolName, rawInput);
      handlePermissionDecision(request.requestId, {
        allow: true,
        rememberEntry: rememberEntry ?? undefined,
      });
    }
  }, [handlePermissionDecision, pendingPermissionRequests]);

  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleInputFocusChange = useCallback(
    (focused: boolean) => {
      setIsInputFocused(focused);
      onInputFocusChange?.(focused);
    },
    [onInputFocusChange],
  );

  return {
    input,
    setInput,
    applyExternalComposerInput,
    applyIntentComposerInput,
    textareaRef,
    isTextareaExpanded,
    thinkingMode,
    setThinkingMode,
    slashCommandsCount,
    filteredCommands,
    frequentCommands,
    commandQuery,
    showCommandMenu,
    selectedCommandIndex,
    resetCommandMenuState,
    dismissCommandMenu,
    handleCommandSelect,
    handleToggleCommandMenu,
    showFileDropdown,
    filteredFiles: filteredFiles as MentionableFile[],
    selectedFileIndex,
    activeFileMentionPaths,
    fileReferencePaths: activeFileMentionPaths,
    selectFile,
    addFileReferences,
    setPromptWithReferences,
    removeFileReference,
    attachedImages,
    setAttachedImages,
    uploadingImages,
    imageErrors,
    getRootProps,
    getInputProps,
    isDragActive,
    openImagePicker: open,
    handleSubmit,
    handleInputChange,
    insertAtCursor,
    handleKeyDown,
    handlePaste,
    handleTextareaClick,
    handleTextareaInput,
    handleClearInput,
    handleAbortSession,
    handlePermissionDecision,
    handleGrantToolPermission,
    handleGrantSessionToolPermission,
    handleInputFocusChange,
    isInputFocused,
  };
}
