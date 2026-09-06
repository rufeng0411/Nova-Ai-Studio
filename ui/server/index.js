#!/usr/bin/env node
// PD-SAAS-FORK: hide Windows console windows for all child processes
import '../../scripts/lib/patchHiddenConsole.mjs';
// Load environment variables before other imports execute
import { assertRequiredPilotDeckEnv } from './load-env.js';
// Install global fetch proxy (PILOTDECK_PROXY / HTTPS_PROXY) before any network calls
import { installGlobalProxy } from './utils/proxy.js';
installGlobalProxy();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const installMode = fs.existsSync(path.join(__dirname, '..', '..', '.git')) ? 'git' : 'npm';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    dim: '\x1b[2m',
};

const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    ok: (text) => `${colors.green}${text}${colors.reset}`,
    warn: (text) => `${colors.yellow}${text}${colors.reset}`,
    tip: (text) => `${colors.blue}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

assertRequiredPilotDeckEnv();
if (process.env.npm_lifecycle_event === 'dev:server') {
    process.env.PILOTDECK_UI_DEV = '1';
}
console.log('SERVER_PORT from runtime config:', process.env.SERVER_PORT);

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import os from 'os';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import { spawn, exec } from './utils/childProcess.js';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';
import JSZip from 'jszip';
import { readPermissionSettings } from './services/permissionSettings.js';
import {
  resolvePathInProject,
  resolvePreviewPath,
  resolveExistingProjectFilePath,
  resolveProjectDeliverableFile,
} from './utils/pathInProject.js';
import { applyProjectMediaCacheHeaders, applyProjectPreviewCacheHeaders } from './utils/projectFileCacheHeaders.js';
import { serveProjectBinary } from './utils/serveProjectBinary.js';
import { registerMarkdownShareAuthRoutes } from './saas/share/markdownShareAuthRoutes.js';
import {
  registerLegacyMarkdownShareDeprecation,
  registerMarkdownSharePublicRoutes,
} from './saas/share/markdownSharePublicRoutes.js';
import { getPublicMdShareMode } from './saas/share/publicMdShareFlag.js';
import { createPrecompressedStatic } from './utils/precompressedStatic.js';
import {
    createProjectThumbnail,
    isSupportedThumbnailSource,
    normalizeThumbnailOptions,
    streamThumbnailFile,
} from './utils/projectThumbnail.js';

import { getProjects, getProjectCronJobsOverview, getSessions, renameProject, deleteSession, deleteProject, addProjectManually, extractProjectDirectory, getDeliverableSearchRootsForProject, warmProjectDirectoryForDeliverables, clearProjectDirectoryCache, searchConversations } from './projects.js';
import { getDataRoot, getTenantPilotHome } from './saas/tenant/paths.js';
import { projectsKey } from './saas/cache/cacheKeys.js';
import { resolveProjectsCacheKey, invalidateProjectsListCache } from './saas/conversation/catalogCache.js';
import { catalogStore } from './saas/conversation/CatalogStore.js';
import { cacheDel, cacheGet, cacheSet, getDefaultTtl } from './saas/cache/redisClient.js';
import {
    runChatViaGateway,
    abortViaGateway,
    decidePermissionViaGateway,
    grantSessionPermissionViaGateway,
    isSessionActiveViaGateway,
    getActiveTurnSnapshotFramesViaGateway,
    getActiveSessionIdsViaGateway,
    elicitationRespondViaGateway,
    getRouterDashboardData,
    getRouterSessionStats,
    getRouterStatsSummary,
    getPilotDeckGateway,
    registerAlwaysOnNotificationForwarding,
    getSessionTokenBudget,
    getBridgeSessionStateSnapshot,
    newSessionKey,
} from './pilotdeck-bridge.js';
import { evaluateTurnConcurrencyGate } from './saas/concurrency/turnConcurrencyGate.js';
import { isTurnQueueEnabled } from './saas/concurrency/turnQueueConfig.js';
import {
    acceptTurn,
    pauseTurn,
    unpauseSession,
    cancelQueuedTurnRequest,
    registerTurnQueueBridgeDeps,
} from './saas/concurrency/turnAcceptanceService.js';
import { registerTurnQueuePump, hydrateAndPumpAllQueuedOnStartup, repairUserTurnQueue } from './saas/concurrency/turnQueuePump.js';
import sessionManager from './sessionManager.js';
import gitRoutes from './routes/git.js';
import authRoutes from './routes/auth.js';
import mcpRoutes from './routes/mcp.js';
import taskmasterRoutes from './routes/taskmaster.js';
import memoryRoutes, { MEMORY_DASHBOARD_DIR } from './routes/memory.js';
import mcpUtilsRoutes from './routes/mcp-utils.js';
import commandsRoutes from './routes/commands.js';
import skillsRoutes from './routes/skills.js';
// >>> pilotdeck-fork: capability-hub
import capabilitiesRoutes from './routes/capabilities.js';
import launchRoutes, {
  launchStaticRouter,
  openDesignStaticRouter,
  pptCanvasStaticRouter,
  pptMasterStaticRouter,
  preflightRasterStaticRouter,
} from './routes/launch.js';
import processTemplatesRoutes from './routes/processTemplates.js';
// <<< pilotdeck-fork: capability-hub
import settingsRoutes from './routes/settings.js';
import configRoutes from './routes/config.js';
import providersRoutes from './routes/providers.js';
import { startPilotDeckConfigWatcher, stopPilotDeckConfigWatcher } from './services/pilotdeckConfigWatcher.js';
import { getAlwaysOnDashboardEvents } from './services/always-on-events.js';
import agentRoutes from './routes/agent.js';
import updateRoutes from './routes/update.js';
import projectsRoutes, { WORKSPACES_ROOT, validateWorkspacePath } from './routes/projects.js';
// PD-SAAS-FORK: UI document export (capabilities + async jobs)
import exportRoutes from './saas/export/exportRoutes.js';
import userRoutes from './routes/user.js';
import pluginsRoutes from './routes/plugins.js';
import messagesRoutes from './routes/messages.js';
import runtimeFeatureFlagsRoutes from './routes/runtimeFeatureFlags.js';
import { registerDeliverableTaskFolderRoutes } from './routes/deliverableTaskFolder.js';
// PD-SAAS-FORK: product marketing site (SEO/GEO) — flag PILOTDECK_MARKETING_SITE
import { marketingStaticMiddleware } from './saas/marketing/marketingStatic.js';
import {
  isMarketingAnalyticsEnabled,
  isMarketingContactEnabled,
  isMarketingSiteEnabled,
  isRegisterInviteCodeEnabled,
} from './saas/marketing/marketingPathMatch.js';
import { requestBackpressure, tryAcquireBackpressure } from './middleware/requestBackpressure.js';
import { closeMemoryServices, startMemoryScheduler, stopMemoryScheduler } from './services/memoryService.js';
import { createNormalizedMessage } from './pilotdeck-message.js';
import { startEnabledPluginServers, stopAllPlugins, getPluginPort } from './utils/plugin-process-manager.js';
import { initializeDatabase, sessionNamesDb, applyCustomSessionNames, userDb } from './database/db.js';
import { configureWebPush } from './services/vapid-keys.js';
import { sendCronDaemonRequest } from './services/cron-daemon-owner.js';
import { createAlwaysOnHeartbeatManager } from './always-on-heartbeat.js';

import {
    BROWSE_ROOTS_TOKEN,
    createFileInDirectory,
    ensureFilesystemPath,
    expandWorkspacePath as expandWorkspacePathUtil,
    getBrowseParentPath,
    listBrowseDirectory,
    listQuickRoots,
    resolveBrowseQueryPath,
} from './utils/filesystemBrowse.js';
import { runServerStartupBeforeListen, startServerAfterStartup } from './services/server-startup.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';
import { DISABLE_LOCAL_AUTH, IS_PLATFORM, IS_SAAS_MODE } from './constants/config.js';
import { checkChatQuota, consumeCredit } from './saas/billing/quotaGate.js';
import { initializeSaasBackend, registerSaas } from './saas/index.js';
import { saasRequestStore, getSaasRequestContext } from './saas/context.js';
import { isSaasMode } from './saas/mode.js';
import { groupProjectUpdateClients } from './saas/projectsUpdateScopes.js';
import {
    assertStoragePathAllowed,
    saasBlocksUserFileMutation,
    saasBlocksUserFileMutationForPath,
    isDesignCanvasBoardWritePath,
} from './saas/storage/fileStorageService.js';
import {
    appendBentoDeckWriteAudit,
    bentoSha256ContentHex,
    isBentoDeckWritePath,
    validateBentoDeckWrite,
} from './saas/storage/bentoWritePolicy.js';
import {
    hasBentoDocBlock as hasBentoDocBlockInHtml,
    repairProjectBentoDeckHtml,
} from './saas/deliverables/repairStaticHtmlToBento.js';
import {
    appendHtmlStudioWriteAudit,
    isHtmlDeliverableWritePath,
    sha256ContentHex,
    validateHtmlDeliverableWrite,
} from './saas/storage/htmlStudioWritePolicy.js';
import {
    appendHfStudioWriteAudit,
    isHfStudioWritePath,
    sha256ContentHex as hfSha256ContentHex,
    validateHfStudioWrite,
} from './saas/storage/hfStudioWritePolicy.js';
import {
    createHfRenderJob,
    getHfRenderJob,
    runHfDoctor,
} from './saas/hyperframes/hfStudioRender.js';
import { atomicWriteTextFile } from './utils/atomicWrite.js';
// PD-SAAS-FORK: tenant ownership check for cron run/stop/delete operations.
import { resolveCronTaskForTenant } from './saas/alwaysOnScope.js';
import { getConnectableHost } from '../shared/networkHosts.js';
import {
    listenWithPortFallback,
    PORT_FALLBACK_ATTEMPTS,
} from './lib/listenWithPortFallback.js';
import { contentDispositionAttachment } from './utils/downloadHeaders.js';

// PilotDeck-only mode: chat execution always goes through src/gateway via
// cursor-cli, openai-codex, gemini-cli) has been removed.
const VALID_PROVIDERS = ['pilotdeck'];

// File-system watchers for the chat transcript root maintained by
// PilotDeck. Provider-specific watchers (.pilotdeck) were dropped along with the four provider adapters.
// .gemini) were dropped along with the four provider adapters.
const PROVIDER_WATCH_PATHS = [
    {
        provider: 'pilotdeck',
        rootPath: path.join(
            process.env.PILOT_HOME || path.join(os.homedir(), '.pilotdeck'),
            'projects',
        ),
    },
];
const WATCHER_IGNORED_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.tmp',
    '**/*.swp',
    '**/.DS_Store'
];
const WATCHER_DEBOUNCE_MS = 300;
let projectsWatchers = [];
let projectsWatcherDebounceTimer = null;
const connectedClients = new Set();

registerTurnQueueBridgeDeps({
    newSessionKey,
    runChatViaGateway,
    abortViaGateway,
});
registerTurnQueuePump({
  clients: connectedClients,
  runChat: runChatViaGateway,
  getBridgeSessionStates: getBridgeSessionStateSnapshot,
});
const alwaysOnHeartbeat = createAlwaysOnHeartbeatManager({
    // Legacy four-provider session details have been removed; PilotDeck
    // gateway sessions are tracked by `pilotdeck-bridge.js` instead.
    getActivePilotDeckSessions: () => []
});
registerAlwaysOnNotificationForwarding(connectedClients);
let isGetProjectsRunning = false; // Flag to prevent reentrant calls

// Broadcast progress to all connected WebSocket clients
function broadcastProgress(progress) {
    const message = JSON.stringify({
        type: 'loading_progress',
        ...progress
    });
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function sendJsonToClients(clients, payload) {
    const message = JSON.stringify(payload);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function createProjectUpdatePayload({ projects, eventType, filePath, provider, rootPath }) {
    return {
        type: 'projects_updated',
        projects,
        timestamp: new Date().toISOString(),
        changeType: eventType,
        changedFile: path.relative(rootPath, filePath),
        watchProvider: provider,
    };
}

async function broadcastScopedSaasProjectUpdates({ eventType, filePath, provider, rootPath }) {
    const groups = groupProjectUpdateClients(connectedClients);
    for (const { scope, clients } of groups) {
        try {
            await saasRequestStore.run(
                {
                    tenantId: scope.tenantId,
                    tenantPilotHome: getTenantPilotHome(scope.tenantId),
                    userId: scope.userId,
                    role: scope.role,
                },
                async () => {
                    const progress = (nextProgress) => sendJsonToClients(clients, {
                        type: 'loading_progress',
                        ...nextProgress,
                    });
                    const updatedProjects = await getProjects(progress);
                    const cacheKey = await resolveProjectsCacheKey({
                        tenantId: scope.tenantId,
                        userId: scope.userId ?? undefined,
                    });
                    void cacheSet(cacheKey, updatedProjects, getDefaultTtl('projects'));
                    sendJsonToClients(clients, createProjectUpdatePayload({
                        projects: updatedProjects,
                        eventType,
                        filePath,
                        provider,
                        rootPath,
                    }));
                },
            );
        } catch (error) {
            console.warn('[projects] scoped SaaS project update failed:', error?.message || error);
        }
    }
}

// Broadcasts ~/.pilotdeck/pilotdeck.yaml reload events (from UI saves or external file edits)
// to every connected WebSocket client so open Settings tabs refresh instantly.
function broadcastConfigReloaded(payload) {
    const message = JSON.stringify({ type: 'config:reloaded', ...payload });
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
process.on('pilotdeck:config-broadcast', broadcastConfigReloaded);


async function setupProjectsWatcher() {
    const chokidar = (await import('chokidar')).default;

    if (projectsWatcherDebounceTimer) {
        clearTimeout(projectsWatcherDebounceTimer);
        projectsWatcherDebounceTimer = null;
    }

    await Promise.all(
        projectsWatchers.map(async (watcher) => {
            try {
                await watcher.close();
            } catch (error) {
                console.error('[WARN] Failed to close watcher:', error);
            }
        })
    );
    projectsWatchers = [];

    const debouncedUpdate = (eventType, filePath, provider, rootPath) => {
        if (projectsWatcherDebounceTimer) {
            clearTimeout(projectsWatcherDebounceTimer);
        }

        projectsWatcherDebounceTimer = setTimeout(async () => {
            // Prevent reentrant calls
            if (isGetProjectsRunning) {
                return;
            }

            try {
                isGetProjectsRunning = true;

                // Clear project directory cache when files change
                clearProjectDirectoryCache();

                if (IS_SAAS_MODE) {
                    await broadcastScopedSaasProjectUpdates({ eventType, filePath, provider, rootPath });
                    return;
                }

                // Get updated projects list
                const updatedProjects = await getProjects(broadcastProgress);

                // Notify all connected clients about the project changes
                sendJsonToClients(connectedClients, createProjectUpdatePayload({
                    projects: updatedProjects,
                    eventType,
                    filePath,
                    provider,
                    rootPath,
                }));

            } catch (error) {
                console.error('[ERROR] Error handling project changes:', error);
            } finally {
                isGetProjectsRunning = false;
            }
        }, WATCHER_DEBOUNCE_MS);
    };

    for (const { provider, rootPath } of PROVIDER_WATCH_PATHS) {
        try {
            // chokidar v4 emits ENOENT via the "error" event for missing roots and will not auto-recover.
            // Ensure provider folders exist before creating the watcher so watching stays active.
            await fsPromises.mkdir(rootPath, { recursive: true });

            // Initialize chokidar watcher with optimized settings
            const watcher = chokidar.watch(rootPath, {
                ignored: WATCHER_IGNORED_PATTERNS,
                persistent: true,
                ignoreInitial: true, // Don't fire events for existing files on startup
                followSymlinks: false,
                depth: 10, // Reasonable depth limit
                awaitWriteFinish: {
                    stabilityThreshold: 100, // Wait 100ms for file to stabilize
                    pollInterval: 50
                }
            });

            // Set up event listeners
            watcher
                .on('add', (filePath) => debouncedUpdate('add', filePath, provider, rootPath))
                .on('change', (filePath) => debouncedUpdate('change', filePath, provider, rootPath))
                .on('unlink', (filePath) => debouncedUpdate('unlink', filePath, provider, rootPath))
                .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath, provider, rootPath))
                .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath, provider, rootPath))
                .on('error', (error) => {
                    console.error(`[ERROR] ${provider} watcher error:`, error);
                })
                .on('ready', () => {
                });

            projectsWatchers.push(watcher);
        } catch (error) {
            console.error(`[ERROR] Failed to setup ${provider} watcher for ${rootPath}:`, error);
        }
    }

    if (projectsWatchers.length === 0) {
        console.error('[ERROR] Failed to setup any provider watchers');
    }
}


const app = express();
const server = http.createServer(app);

const ptySessionsMap = new Map();
const PTY_SESSION_TIMEOUT = 30 * 60 * 1000;
const SHELL_URL_PARSE_BUFFER_LIMIT = 32768;
const ANSI_ESCAPE_SEQUENCE_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g;
const TRAILING_URL_PUNCTUATION_REGEX = /[)\]}>.,;:!?]+$/;

function stripAnsiSequences(value = '') {
    return value.replace(ANSI_ESCAPE_SEQUENCE_REGEX, '');
}

function normalizeDetectedUrl(url) {
    if (!url || typeof url !== 'string') return null;

    const cleaned = url.trim().replace(TRAILING_URL_PUNCTUATION_REGEX, '');
    if (!cleaned) return null;

    try {
        const parsed = new URL(cleaned);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

function extractUrlsFromText(value = '') {
    const directMatches = value.match(/https?:\/\/[^\s<>"'`\\\x1b\x07]+/gi) || [];

    // Handle wrapped terminal URLs split across lines by terminal width.
    const wrappedMatches = [];
    const continuationRegex = /^[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$/;
    const lines = value.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const startMatch = line.match(/https?:\/\/[^\s<>"'`\\\x1b\x07]+/i);
        if (!startMatch) continue;

        let combined = startMatch[0];
        let j = i + 1;
        while (j < lines.length) {
            const continuation = lines[j].trim();
            if (!continuation) break;
            if (!continuationRegex.test(continuation)) break;
            combined += continuation;
            j++;
        }

        wrappedMatches.push(combined.replace(/\r?\n\s*/g, ''));
    }

    return Array.from(new Set([...directMatches, ...wrappedMatches]));
}

function shouldAutoOpenUrlFromOutput(value = '') {
    const normalized = value.toLowerCase();
    return (
        normalized.includes('browser didn\'t open') ||
        normalized.includes('open this url') ||
        normalized.includes('continue in your browser') ||
        normalized.includes('press enter to open') ||
        normalized.includes('open_url:')
    );
}

// Single WebSocket server that handles both paths
const wss = new WebSocketServer({
    server,
    verifyClient: (info, done) => {
        console.log('WebSocket connection attempt to:', info.req.url);

        void (async () => {
            try {
                // PD-SAAS-FORK: SaaS requires JWT on WebSocket (same as OSS with auth enabled).
                if ((IS_PLATFORM || DISABLE_LOCAL_AUTH) && !IS_SAAS_MODE) {
                    const user = await authenticateWebSocket(null);
                    if (!user) {
                        console.log('[WARN] WebSocket auth bypass: No user found in database');
                        done(false, 401, 'Unauthorized');
                        return;
                    }
                    info.req.user = user;
                    console.log('[OK] WebSocket authenticated (bypass) for user:', user.username);
                    done(true);
                    return;
                }

                const url = new URL(info.req.url, 'http://localhost');
                const token = url.searchParams.get('token') ||
                    info.req.headers.authorization?.split(' ')[1];

                const user = await authenticateWebSocket(token);
                if (!user) {
                    console.log('[WARN] WebSocket authentication failed');
                    done(false, 401, 'Unauthorized');
                    return;
                }

                info.req.user = user;
                console.log('[OK] WebSocket authenticated for user:', user.username);
                done(true);
            } catch (error) {
                console.error('[WARN] WebSocket authentication error:', error);
                done(false, 500, 'Internal Server Error');
            }
        })();
    }
});

// Make WebSocket server available to routes
app.locals.wss = wss;

app.use(cors({ exposedHeaders: ['X-Refreshed-Token'] }));
app.use(express.json({
    limit: '50mb',
    type: (req) => {
        // Skip multipart/form-data requests (for file uploads like images)
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
            return false;
        }
        return contentType.includes('json');
    }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Public health check endpoint (no authentication required)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        installMode
    });
});

// Optional API key validation (if configured)
app.use('/api', validateApiKey);

// Authentication routes (public)
app.use('/api/auth', authRoutes);
// PD-SAAS-FORK: tenant context middleware for authenticated API routes
registerSaas(app);

// Projects API Routes (protected)
app.use('/api/projects', authenticateToken, projectsRoutes);
app.use('/api/projects', authenticateToken, exportRoutes);

// Git API Routes (protected)
app.use('/api/git', authenticateToken, gitRoutes);

// MCP API Routes (protected)
app.use('/api/mcp', authenticateToken, mcpRoutes);

// TaskMaster API Routes (protected)
app.use('/api/taskmaster', authenticateToken, taskmasterRoutes);

// Memory API Routes (protected)
app.use('/api/memory', authenticateToken, memoryRoutes);

// MCP utilities
app.use('/api/mcp-utils', authenticateToken, mcpUtilsRoutes);

// Commands API Routes (protected)
app.use('/api/commands', authenticateToken, commandsRoutes);

// Skills API Routes (protected) — list/edit/install skills surfaced in the
// top-right Skills tab. Backed by ~/.pilotdeck/skills/ and project-level
// .pilotdeck/skills/ via PilotDeck plugin runtime.
app.use('/api/skills', authenticateToken, skillsRoutes);
// >>> pilotdeck-fork: capability-hub
app.use('/api/capabilities', authenticateToken, capabilitiesRoutes);
app.use('/api/launch/static/html-ppt', launchStaticRouter);
app.use('/api/launch/static/open-design', openDesignStaticRouter);
app.use('/api/launch/static/ppt-master', pptMasterStaticRouter);
app.use('/api/launch/static/ppt-canvas', pptCanvasStaticRouter);
app.use('/api/launch/static/preflight-raster', preflightRasterStaticRouter);
app.use('/api/launch', authenticateToken, launchRoutes);
app.use('/api/process-templates', authenticateToken, processTemplatesRoutes);
// <<< pilotdeck-fork: capability-hub

// Settings API Routes (protected)
app.use('/api/settings', authenticateToken, settingsRoutes);

// PilotDeck unified YAML config routes (protected)
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/providers', authenticateToken, providersRoutes);

// User API Routes (protected)
app.use('/api/user', authenticateToken, userRoutes);

// Plugins API Routes (protected)
app.use('/api/plugins', authenticateToken, pluginsRoutes);

// Unified session messages route (protected) — PilotDeck-only.
app.use('/api/sessions', authenticateToken, messagesRoutes);

// PD-SAAS-FORK: runtime UI feature flags (override Vite build defaults)
app.use('/api/runtime/feature-flags', authenticateToken, runtimeFeatureFlagsRoutes);

// Agent API Routes (uses API key authentication)
app.use('/api/agent', agentRoutes);

// Self-update API Routes (protected)
app.use('/api/update', authenticateToken, updateRoutes);

// Legacy four-provider config endpoints have been removed. The runtime
// model is read from PilotDeck config; fall back to a static stub so any
// older frontend code paths render without crashing.
app.get('/api/agents/runtime-config', authenticateToken, (_req, res) => {
    const permSettings = readPermissionSettings();
    res.json({
        pilotdeck: { provider: 'pilotdeck' },
        permissions: {
            skipPermissions: permSettings.skipPermissions,
            effectiveMode: permSettings.skipPermissions ? 'bypassPermissions' : 'default',
        },
    });
});

// Provider-specific endpoints removed by the PilotDeck-only migration.
// Returning a structured error keeps any stragglers in the UI from
// hanging on an unanswered fetch.
const PROVIDER_REMOVED_PATHS = ['/api/cursor', '/api/codex', '/api/gemini', '/api/cli'];
for (const removedPrefix of PROVIDER_REMOVED_PATHS) {
    app.use(removedPrefix, (_req, res) => {
        res.status(410).json({
            error: 'endpoint_removed',
            message: `Provider endpoint ${removedPrefix} was removed during the NovaStudio-only migration.`,
        });
    });
}

// PilotDeck routing dashboard. The `/api/ccr/*` URL family was kept for
// frontend back-compat (Dashboard tab + useRouterSettings) but the data
// now comes from `src/router/stats/TokenStatsCollector` via the

app.get('/api/ccr/dashboard', authenticateToken, async (req, res) => {
    try {
        let data = getRouterDashboardData();
        // PD-SAAS-FORK: regular users only see their own usage; admins may opt into system-wide.
        if (IS_SAAS_MODE) {
            const role = req.user?.role;
            const isAdmin = role === 'super-admin' || role === 'admin';
            const scope = typeof req.query.scope === 'string' ? req.query.scope : 'me';
            const userId = req.user?.id ?? req.user?.userId ?? null;
            const showSystem = isAdmin && scope === 'system';
            if (!showSystem && userId != null) {
                const { filterRouterDashboardByUser } = await import('./saas/usage/store.js');
                data = await filterRouterDashboardByUser(data, userId);
            }
        }
        res.json(data);
    } catch (error) {
        console.error('[router-dashboard] failed:', error);
        res.status(500).json({ error: error?.message || 'router-dashboard failed' });
    }
});

app.get('/api/always-on/events', authenticateToken, async (req, res) => {
    try {
        const limit = Number.parseInt(req.query?.limit || '', 10);
        const since = req.query?.since || undefined;
        const result = await getAlwaysOnDashboardEvents({
            limit: Number.isFinite(limit) ? limit : 200,
            since: typeof since === 'string' ? since : undefined,
        });
        res.json(result);
    } catch (error) {
        console.error('[always-on-events] failed:', error);
        res.status(500).json({ error: error?.message || 'always-on-events failed' });
    }
});

app.get('/api/always-on/cron-jobs', authenticateToken, async (_req, res) => {
    try {
        const result = await getProjectCronJobsOverview();
        res.json(result);
    } catch (error) {
        console.error('[always-on-cron-jobs] failed:', error);
        res.status(500).json({ error: error?.message || 'always-on-cron-jobs failed' });
    }
});

app.post('/api/always-on/cron-jobs/:taskId/run-now', authenticateToken, async (req, res) => {
    try {
        const gateway = await getPilotDeckGateway();
        // PD-SAAS-FORK: reject operating on another tenant's cron task.
        const scope = await resolveCronTaskForTenant(gateway, req.params.taskId);
        if (!scope.allowed) {
            return res.status(scope.reason === 'not_found' ? 404 : 403)
                .json({ error: scope.reason === 'not_found' ? 'task not found' : 'forbidden' });
        }
        const result = await gateway.cronRunNow({ taskId: req.params.taskId });
        res.json(result);
    } catch (error) {
        console.error('[always-on-cron-run-now] failed:', error);
        res.status(500).json({ error: error?.message || 'cron run-now failed' });
    }
});

app.post('/api/always-on/cron-jobs/:taskId/stop', authenticateToken, async (req, res) => {
    try {
        const gateway = await getPilotDeckGateway();
        // PD-SAAS-FORK: reject operating on another tenant's cron task.
        const scope = await resolveCronTaskForTenant(gateway, req.params.taskId);
        if (!scope.allowed) {
            return res.status(scope.reason === 'not_found' ? 404 : 403)
                .json({ error: scope.reason === 'not_found' ? 'task not found' : 'forbidden' });
        }
        const result = await gateway.cronStop({ taskId: req.params.taskId });
        res.json(result);
    } catch (error) {
        console.error('[always-on-cron-stop] failed:', error);
        res.status(500).json({ error: error?.message || 'cron stop failed' });
    }
});

app.delete('/api/always-on/cron-jobs/:taskId', authenticateToken, async (req, res) => {
    try {
        const gateway = await getPilotDeckGateway();
        // PD-SAAS-FORK: reject operating on another tenant's cron task.
        const scope = await resolveCronTaskForTenant(gateway, req.params.taskId);
        if (!scope.allowed) {
            return res.status(scope.reason === 'not_found' ? 404 : 403)
                .json({ error: scope.reason === 'not_found' ? 'task not found' : 'forbidden' });
        }
        const result = await gateway.cronDelete({ taskId: req.params.taskId, stopRunning: true });
        res.json(result);
    } catch (error) {
        console.error('[always-on-cron-delete] failed:', error);
        res.status(500).json({ error: error?.message || 'cron delete failed' });
    }
});

app.get('/api/ccr/health', authenticateToken, (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        port: null,
        embedded: true,
        backend: 'pilotdeck-router',
    });
});

app.get('/api/ccr/config', authenticateToken, (_req, res) => {
    // The legacy CCR YAML schema is no longer the source of truth for
    // model routing — that lives in PilotDeck config now. Return null so
    // the legacy useRouterSettings hook simply renders the "no config"
    // empty state instead of a config editor.
    res.json(null);
});

app.get('/api/ccr/stats/summary', authenticateToken, (_req, res) => {
    try {
        res.json(getRouterStatsSummary());
    } catch (error) {
        res.status(500).json({ error: error?.message || 'router-stats-summary failed' });
    }
});

app.get('/api/ccr/stats/sessions/:sessionId', authenticateToken, (req, res) => {
    try {
        const stats = getRouterSessionStats(req.params.sessionId);
        if (!stats) {
            return res.status(404).json({ error: 'session_not_found' });
        }
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error?.message || 'router-stats-session failed' });
    }
});

app.post('/api/ccr/stats/reset', authenticateToken, (_req, res) => {
    // Reset would require reaching into per-project TokenStatsCollector
    // instances; that is not exposed today. Surface a clear hint instead
    // of silently no-oping.
    res.status(501).json({
        error: 'not_implemented',
        message: 'Per-project router stats reset is not exposed yet; restart the NovaStudio server to clear in-memory state.',
    });
});

app.put('/api/ccr/config', authenticateToken, (_req, res) => {
    res.status(501).json({
        error: 'not_implemented',
        message: 'Routing configuration is owned by NovaStudio config (~/.pilotdeck/pilotdeck.yaml). Edit it directly via /api/config.',
    });
});

app.get('/memory-dashboard', authenticateToken, (req, res) => {
    const indexPath = path.join(MEMORY_DASHBOARD_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
        res.status(404).type('text/plain').send('Memory dashboard assets not bundled.');
        return;
    }
    res.sendFile(indexPath);
});

// PD-SAAS-FORK: split auth for the memory-dashboard iframe bundle.
// index.html stays JWT-protected (token in query); JS/CSS modules are public.
// Browsers loading `app.js` as type=module often omit ?token= from Referer, so
// authenticating every static asset returned 401 JSON and the dashboard never
// booted — users only saw the empty HTML shell ("white screen / a few boxes").
function memoryDashboardStaticAuth(req, res, next) {
    const ext = path.extname(req.path || '').toLowerCase();
    if (!ext || ext === '.html') {
        return authenticateToken(req, res, next);
    }
    return next();
}

app.use('/memory-dashboard', memoryDashboardStaticAuth, express.static(MEMORY_DASHBOARD_DIR, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Hard 404 boundary: anything still asking for /memory-dashboard/* after the
// static middleware is a missing asset. Without this, the request would fall
// through to the SPA wildcard below and return the PilotDeck shell index.html,
// which the MemoryPanel iframe then renders — recursively nesting the entire
// app inside itself (see bug: "嵌套显示 + general memory 多次出现").
app.use('/memory-dashboard', (_req, res) => {
    res.status(404).type('text/plain').send('Not found in memory-dashboard.');
});

// PD-SAAS-FORK: marketing HTML before public/dist static (so `/` is not SPA index when flag on)
app.use(marketingStaticMiddleware);
// Public (no auth): SPA / static site can read marketing flags before login
app.get('/api/runtime/public-flags', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  // Lazy import helpers — keep middleware-free for early SPA boot
  res.json({
    PILOTDECK_MARKETING_SITE: isMarketingSiteEnabled(),
    PILOTDECK_MARKETING_CONTACT: isMarketingContactEnabled(),
    PILOTDECK_MARKETING_ANALYTICS: isMarketingAnalyticsEnabled(),
    PILOTDECK_REGISTER_INVITE_CODE: isRegisterInviteCodeEnabled(),
    PILOTDECK_PUBLIC_MD_SHARE: getPublicMdShareMode(),
  });
});

// Serve public files (like api-docs.html)
app.use(express.static(path.join(__dirname, '../public')));

// PD-SAAS-FORK: prefer precompressed .br / .gz from Vite build before raw assets
const distDir = path.join(__dirname, '../dist');
const setDistAssetHeaders = (res, filePath) => {
    if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
};

app.use(createPrecompressedStatic(distDir, setDistAssetHeaders));

// Static files served after API routes
// Add cache control: HTML files should not be cached, but assets can be cached
app.use(express.static(distDir, {
    setHeaders: (res, filePath) => {
        setDistAssetHeaders(res, filePath);
    }
}));

// API Routes (protected)
// /api/config endpoint removed - no longer needed
// Frontend now uses window.location for WebSocket URLs.
// /api/system/update was the V1 "Update available" banner backend; the
// VersionUpgradeModal that consumed it was removed during the V1 cleanup.

const projectsRefreshInFlight = new Map();

// PD-SAAS-FORK: cached project lists return immediately; refresh happens once in background.
function refreshProjectsCacheInBackground(cacheKey) {
    if (projectsRefreshInFlight.has(cacheKey)) return;
    const slot = tryAcquireBackpressure('projects', 'global');
    if (!slot.acquired) return;
    const refresh = getProjects(broadcastProgress)
        .then((projects) => cacheSet(cacheKey, projects, getDefaultTtl('projects')))
        .catch((error) => {
            console.warn('[projects] background cache refresh failed:', error?.message || error);
        })
        .finally(() => {
            slot.release();
            projectsRefreshInFlight.delete(cacheKey);
        });
    projectsRefreshInFlight.set(cacheKey, refresh);
}

app.get('/api/projects', authenticateToken, requestBackpressure('projects'), async (req, res) => {
    try {
        const cacheKey = IS_SAAS_MODE
            ? await resolveProjectsCacheKey(req.user)
            : projectsKey({
                tenantId: req.user?.tenantId ?? 'platform',
                userId: req.user?.id ?? 'anon',
            });
        const bypassCache = req.query.fresh === '1' || typeof req.query.fresh === 'string';
        const cached = bypassCache ? null : await cacheGet(cacheKey);
        // PD-SAAS-FORK: never serve an empty cached sidebar — it sticks after a gateway race.
        if (Array.isArray(cached) && cached.length > 0) {
            refreshProjectsCacheInBackground(cacheKey);
            return res.json(cached);
        }
        const projects = await getProjects(broadcastProgress);
        void cacheSet(cacheKey, projects, getDefaultTtl('projects'));
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects/:projectName/sessions', authenticateToken, async (req, res) => {
    try {
        const { limit = 10, offset = 0, includeOlder } = req.query;
        const result = await getSessions(
            req.params.projectName,
            parseInt(limit, 10),
            parseInt(offset, 10),
            { includeOlder: includeOlder === '1' || includeOlder === 'true' },
        );
        applyCustomSessionNames(result.sessions, 'pilotdeck');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rename project endpoint
app.put('/api/projects/:projectName/rename', authenticateToken, async (req, res) => {
    try {
        const { displayName } = req.body;
        await renameProject(req.params.projectName, displayName);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete session endpoint
app.delete('/api/projects/:projectName/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { projectName, sessionId } = req.params;
        console.log(`[API] Deleting session: ${sessionId} from project: ${projectName}`);
        const removed = await deleteSession(projectName, sessionId, {
            sessionKind: req.query.sessionKind || null,
            parentSessionId: req.query.parentSessionId || null,
            relativeTranscriptPath: req.query.relativeTranscriptPath || null,
            taskId: req.query.taskId || null,
        });
        if (!removed) {
            return res.status(404).json({ error: 'Session not found or could not be deleted', success: false });
        }
        sessionNamesDb.deleteName(sessionId, 'pilotdeck');
        // PD-SAAS-FORK: drop all cached project-list variants (incl. catalog cv:* keys).
        await invalidateProjectsListCache(req.user);
        console.log(`[API] Session ${sessionId} deleted successfully`);
        res.json({ success: true, deleted: true });
    } catch (error) {
        console.error(`[API] Error deleting session ${req.params.sessionId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Rename session endpoint
app.put('/api/sessions/:sessionId/rename', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '');
        if (!safeSessionId || safeSessionId !== String(sessionId)) {
            return res.status(400).json({ error: 'Invalid sessionId' });
        }
        const { summary, provider } = req.body;
        if (!summary || typeof summary !== 'string' || summary.trim() === '') {
            return res.status(400).json({ error: 'Summary is required' });
        }
        if (summary.trim().length > 500) {
            return res.status(400).json({ error: 'Summary must not exceed 500 characters' });
        }
        if (!provider || !VALID_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
        }
        sessionNamesDb.setName(safeSessionId, provider, summary.trim());
        // PD-SAAS-FORK: dual-write custom title to conversation_catalog.
        if (IS_SAAS_MODE && req.user?.tenantId && req.user?.id) {
            await catalogStore.updateCustomTitle({
                tenantId: req.user.tenantId,
                userId: req.user.id,
                sessionId: safeSessionId,
                customTitle: summary.trim(),
            }).catch(() => undefined);
            await invalidateProjectsListCache(req.user).catch(() => undefined);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`[API] Error renaming session ${req.params.sessionId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Delete project endpoint (force=true to delete with sessions)
app.delete('/api/projects/:projectName', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const force = req.query.force === 'true';
        const removed = await deleteProject(projectName, force);
        if (!removed) {
            return res.status(404).json({
                error: 'Project not found or could not be deleted',
                success: false,
            });
        }
        // PD-SAAS-FORK: drop stale projects list cache after project removal.
        await invalidateProjectsListCache(req.user);
        res.json({ success: true, deleted: true });
    } catch (error) {
        res.status(error?.message?.includes('General') ? 400 : 500).json({ error: error.message });
    }
});

// Create project endpoint
app.post('/api/projects/create', authenticateToken, async (req, res) => {
    try {
        const { path: projectPath } = req.body;

        if (!projectPath || !projectPath.trim()) {
            return res.status(400).json({ error: 'Project path is required' });
        }

        const project = await addProjectManually(projectPath.trim());
        await invalidateProjectsListCache(req.user);
        res.json({ success: true, project });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: error.message });
    }
});

// PD-SAAS-FORK: repair stuck queued/running catalog rows and ghost turn slots.
app.post('/api/saas/turn-queue/repair', authenticateToken, async (req, res) => {
    if (!IS_SAAS_MODE || !isTurnQueueEnabled()) {
        return res.json({ ok: true, skipped: true });
    }
    try {
        const userId = req.user?.id ?? req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await saasRequestStore.run(
            {
                tenantId,
                tenantPilotHome: getTenantPilotHome(tenantId),
                userId,
                role: req.user?.role ?? null,
            },
            () => repairUserTurnQueue({
                tenantId,
                userId,
                role: req.user?.role ?? null,
            }),
        );
        await invalidateProjectsListCache(req.user);
        res.json({ ok: true, ...result });
    } catch (error) {
        console.warn('[turn-queue] repair failed:', error instanceof Error ? error.message : error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'repair failed' });
    }
});

// Search conversations content (SSE streaming)
app.get('/api/search/conversations', authenticateToken, async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const parsedLimit = Number.parseInt(String(req.query.limit), 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.max(1, Math.min(parsedLimit, 100));

    if (query.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    let closed = false;
    const abortController = new AbortController();
    req.on('close', () => { closed = true; abortController.abort(); });

    try {
        await searchConversations(query, limit, ({ projectResult, totalMatches, scannedProjects, totalProjects }) => {
            if (closed) return;
            if (projectResult) {
                res.write(`event: result\ndata: ${JSON.stringify({ projectResult, totalMatches, scannedProjects, totalProjects })}\n\n`);
            } else {
                res.write(`event: progress\ndata: ${JSON.stringify({ totalMatches, scannedProjects, totalProjects })}\n\n`);
            }
        }, abortController.signal);
        if (!closed) {
            res.write(`event: done\ndata: {}\n\n`);
        }
    } catch (error) {
        console.error('Error searching conversations:', error);
        if (!closed) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: 'Search failed' })}\n\n`);
        }
    } finally {
        if (!closed) {
            res.end();
        }
    }
});

const expandWorkspacePath = (inputPath) => expandWorkspacePathUtil(inputPath, WORKSPACES_ROOT);

function setPreviewContentType(res, filePath) {
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const charset = mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json'
        ? '; charset=utf-8'
        : '';
    res.setHeader('Content-Type', `${mimeType}${charset}`);
}

/** PD-SAAS-FORK: tenant/user storage boundary for SaaS file APIs */
async function guardSaasStoragePath(absPath) {
    if (!isSaasMode()) return absPath;
    return assertStoragePathAllowed(absPath);
}

function storagePathForbiddenResponse(res, error) {
    return res.status(403).json({
        error: error?.message || 'Access denied',
        ok: false,
    });
}

async function addDirectoryToZip(zip, directoryPath, rootPath) {
    const entries = await fsPromises.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
        const absolutePath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join('/');

        if (!relativePath) {
            continue;
        }

        if (entry.isDirectory()) {
            zip.folder(relativePath);
            await addDirectoryToZip(zip, absolutePath, rootPath);
            continue;
        }

        if (entry.isFile()) {
            if (isSaasMode()) {
                await guardSaasStoragePath(absolutePath);
            }
            const [content, stats] = await Promise.all([
                fsPromises.readFile(absolutePath),
                fsPromises.stat(absolutePath),
            ]);
            zip.file(relativePath, content, { date: stats.mtime });
        }
    }
}

function getSafeZipFilename(projectName) {
    const safeName = String(projectName || 'project')
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
        .replace(/^\.+$/, 'project')
        .trim() || 'project';
    return `${safeName}.zip`;
}

// Browse filesystem endpoint for project suggestions - uses existing getFileTree
app.get('/api/browse-filesystem', authenticateToken, async (req, res) => {
    try {
        // PD-SAAS-FORK: path picker is single-user only.
        if (isSaasMode()) {
            return res.status(403).json({ error: 'Filesystem browsing is not available in SaaS mode.' });
        }
        const { path: dirPath } = req.query;
        const resolved = resolveBrowseQueryPath(
            dirPath ? String(dirPath) : BROWSE_ROOTS_TOKEN,
            WORKSPACES_ROOT,
        );

        if (resolved.kind === 'roots') {
            const suggestions = await listQuickRoots(WORKSPACES_ROOT);
            return res.json({
                path: BROWSE_ROOTS_TOKEN,
                kind: 'roots',
                parentPath: null,
                suggestions,
            });
        }

        const resolvedPath = resolved.targetPath;

        try {
            await fs.promises.access(resolvedPath);
            const stats = await fs.promises.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return res.status(400).json({ error: 'Path is not a directory' });
            }
        } catch {
            return res.status(404).json({ error: 'Directory not accessible' });
        }

        const suggestions = await listBrowseDirectory(resolvedPath, getFileTree, WORKSPACES_ROOT);

        res.json({
            path: resolvedPath,
            kind: 'directory',
            parentPath: getBrowseParentPath(resolvedPath),
            suggestions,
        });
    } catch (error) {
        console.error('Error browsing filesystem:', error);
        res.status(500).json({ error: 'Failed to browse filesystem' });
    }
});

// PD-SAAS-FORK: ensure workspace directory exists (optional recursive create)
app.post('/api/ensure-path', authenticateToken, async (req, res) => {
    try {
        const { path: folderPath, createMissing } = req.body ?? {};
        const result = await ensureFilesystemPath(
            folderPath,
            Boolean(createMissing),
            WORKSPACES_ROOT,
            validateWorkspacePath,
        );
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }
        return res.json({
            success: true,
            path: result.path,
            existed: result.existed,
            created: result.created,
        });
    } catch (error) {
        console.error('Error ensuring path:', error);
        res.status(500).json({ error: 'Failed to ensure path' });
    }
});

// PD-SAAS-FORK: create empty/small text file inside a validated directory
app.post('/api/create-file', authenticateToken, async (req, res) => {
    try {
        const { dir, name, content } = req.body ?? {};
        const result = await createFileInDirectory(
            dir,
            name,
            typeof content === 'string' ? content : '',
            WORKSPACES_ROOT,
            validateWorkspacePath,
        );
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }
        return res.json({ success: true, path: result.path });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

app.post('/api/create-folder', authenticateToken, async (req, res) => {
    try {
        const { path: folderPath } = req.body;
        if (!folderPath) {
            return res.status(400).json({ error: 'Path is required' });
        }
        const expandedPath = expandWorkspacePath(folderPath);
        const resolvedInput = path.resolve(expandedPath);
        const validation = await validateWorkspacePath(resolvedInput);
        if (!validation.valid) {
            return res.status(403).json({ error: validation.error });
        }
        const targetPath = validation.resolvedPath || resolvedInput;
        const parentDir = path.dirname(targetPath);
        try {
            await fs.promises.access(parentDir);
        } catch (err) {
            return res.status(404).json({ error: 'Parent directory does not exist' });
        }
        try {
            await fs.promises.access(targetPath);
            return res.status(409).json({ error: 'Folder already exists' });
        } catch (err) {
            // Folder doesn't exist, which is what we want
        }
        try {
            await fs.promises.mkdir(targetPath, { recursive: false });
            res.json({ success: true, path: targetPath });
        } catch (mkdirError) {
            if (mkdirError.code === 'EEXIST') {
                return res.status(409).json({ error: 'Folder already exists' });
            }
            throw mkdirError;
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Resolve shortened deliverable paths (e.g. keywords.md → artifacts/geo/.../keywords.md)
app.get('/api/projects/:projectName/file/resolve', authenticateToken, requestBackpressure('resolve'), async (req, res) => {
    try {
        const { projectName } = req.params;
        const { filePath, hintDir } = req.query;
        if (!filePath) {
            return res.status(400).json({ ok: false, error: 'Invalid file path' });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ ok: false, error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const { resolveProjectDeliverableFile, resolveProjectDeliverableFileAsync } = await import('./utils/pathInProject.js');
        const resolveOptions = {};
        if (typeof hintDir === 'string' && hintDir.trim()) {
            resolveOptions.hintDir = hintDir.trim();
        }

        const resolved = process.env.PILOTDECK_DELIVERABLE_ASYNC_RESOLVE === '1'
            ? await resolveProjectDeliverableFileAsync(projectRoot, filePath, knownRoots, resolveOptions)
            : resolveProjectDeliverableFile(projectRoot, filePath, knownRoots, resolveOptions);
        if (!resolved.ok) {
            if (resolved.code === 'ambiguous_deliverable') {
                return res.status(409).json(resolved);
            }
            return res.status(404).json(resolved);
        }
        try {
            await guardSaasStoragePath(resolved.absolutePath);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }
        return res.json(resolved);
    } catch (error) {
        console.error('Error resolving file path:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
});

// PD-SAAS-FORK: batch deliverable validation for T2 panel + turn-end self-check
registerDeliverableTaskFolderRoutes(app, authenticateToken);

app.post('/api/projects/:projectName/deliverables/validate', authenticateToken, requestBackpressure('validate'), async (req, res) => {
    try {
        const { projectName } = req.params;
        const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
        const hintDir = typeof req.body?.hintDir === 'string' ? req.body.hintDir.trim() : undefined;
        const { validateDeliverablesForProject } = await import('./utils/validateDeliverables.js');
        const { buildValidateCoalesceKey, coalesceValidateRequest } = await import('./saas/deliverables/validateRequestCoalescer.js');
        const tenantId = req.user?.tenant_id ?? req.user?.tenantId ?? 'local';
        const userId = req.user?.id ?? 'local';
        const coalesceKey = buildValidateCoalesceKey(tenantId, userId, projectName, hintDir, paths);
        const result = await coalesceValidateRequest(
            coalesceKey,
            () => validateDeliverablesForProject(projectName, paths, {}, { hintDir }),
        );
        return res.json(result);
    } catch (error) {
        console.error('Error validating deliverables:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});

// Read file content endpoint
app.get('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const { filePath, hintDir } = req.query;


        // Security: ensure the requested path is inside the project root
        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const resolveOptions = {};
        if (typeof hintDir === 'string' && hintDir.trim()) {
            resolveOptions.hintDir = hintDir.trim();
        }

        const resolvedResult = resolveExistingProjectFilePath(projectRoot, filePath, knownRoots, resolveOptions);
        if (!resolvedResult.valid) {
            const status = resolvedResult.error === 'File not found' ? 404 : 403;
            return res.status(status).json({ error: resolvedResult.error });
        }
        const resolved = resolvedResult.resolved;

        try {
            await guardSaasStoragePath(resolved);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        try {
            await fsPromises.access(resolved);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = await fsPromises.stat(resolved).catch(() => null);
        if (!stats?.isFile()) {
            return res.status(400).json({ error: 'Path is not a file' });
        }

        const content = await fsPromises.readFile(resolved, 'utf8');
        const relativePath = path.relative(projectRoot, resolved).split(path.sep).join('/');
        res.json({ content, path: resolved, relativePath });
    } catch (error) {
        console.error('Error reading file:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else if (error.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        } else if (error.code === 'EISDIR') {
            res.status(400).json({ error: 'Path is a directory, not a file' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// PD-SAAS-FORK: repair static *.bento.html (no #bento-doc) into editable Bento shell
app.post('/api/projects/:projectName/file/repair-bento', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const { filePath, hintDir } = req.body ?? {};

        if (!filePath || !isBentoDeckWritePath(filePath)) {
            return res.status(400).json({ error: 'Invalid Bento deck path' });
        }

        if (saasBlocksUserFileMutationForPath(filePath)) {
            return res.status(403).json({
                error: 'File changes in SaaS are created through chat. Use download to save files locally.',
            });
        }

        if (!req.body?.allowLossy) {
            return res.status(422).json({
                error: '有损 HTML→Bento 转换已停用。请用「Nova可编辑演示稿」原生生成 deck.bento.html，以保证样式/配图/字体右栏所见即所得。',
            });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const resolveOptions = {};
        if (typeof hintDir === 'string' && hintDir.trim()) {
            resolveOptions.hintDir = hintDir.trim();
        }

        const resolvedResult = resolveExistingProjectFilePath(projectRoot, filePath, knownRoots, resolveOptions);
        if (!resolvedResult.valid) {
            const status = resolvedResult.error === 'File not found' ? 404 : 403;
            return res.status(status).json({ error: resolvedResult.error });
        }
        const resolved = resolvedResult.resolved;

        try {
            await guardSaasStoragePath(resolved);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        const beforeContent = await fsPromises.readFile(resolved, 'utf8');
        if (hasBentoDocBlockInHtml(beforeContent)) {
            const relativePath = path.relative(projectRoot, resolved).split(path.sep).join('/');
            return res.json({
                ok: true,
                alreadyValid: true,
                content: beforeContent,
                relativePath,
                slideCount: 0,
            });
        }

        const deckDir = path.dirname(resolved);
        const backupAbs = path.join(deckDir, 'deck.static.html');
        let backupRelativePath = null;
        try {
            await fsPromises.access(backupAbs);
            backupRelativePath = path.relative(projectRoot, backupAbs).split(path.sep).join('/');
        } catch {
            await fsPromises.writeFile(backupAbs, beforeContent, 'utf8');
            backupRelativePath = path.relative(projectRoot, backupAbs).split(path.sep).join('/');
        }

        const repaired = await repairProjectBentoDeckHtml(beforeContent);
        const validation = validateBentoDeckWrite(beforeContent, repaired.html);
        if (!validation.ok) {
            return res.status(422).json({ error: validation.error });
        }

        await fsPromises.writeFile(resolved, repaired.html, 'utf8');

        const ctx = getSaasRequestContext();
        await appendBentoDeckWriteAudit(getDataRoot(), {
            tenantId: ctx?.tenantId ?? null,
            userId: ctx?.userId ?? null,
            path: String(filePath || ''),
            sha256: bentoSha256ContentHex(repaired.html),
            repairedFrom: 'static-html',
        }).catch((auditError) => {
            console.warn('[bento-deck] repair audit write failed:', auditError?.message || auditError);
        });

        const relativePath = path.relative(projectRoot, resolved).split(path.sep).join('/');
        return res.json({
            ok: true,
            alreadyValid: false,
            content: repaired.html,
            relativePath,
            backupRelativePath,
            slideCount: repaired.slideCount,
            title: repaired.title,
        });
    } catch (error) {
        console.error('Error repairing Bento deck:', error);
        const message = error instanceof Error ? error.message : String(error);
        if (/No static slides found/i.test(message)) {
            return res.status(422).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
});

// Serve raw file bytes for previews and downloads.
app.get('/api/projects/:projectName/files/content', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const { path: filePath, hintDir } = req.query;


        // Security: ensure the requested path is inside the project root
        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const resolveOptions = {};
        if (typeof hintDir === 'string' && hintDir.trim()) {
            resolveOptions.hintDir = hintDir.trim();
        }

        const resolvedResult = resolveExistingProjectFilePath(projectRoot, filePath, knownRoots, resolveOptions);
        if (!resolvedResult.valid) {
            const status = resolvedResult.error === 'File not found' ? 404 : 403;
            return res.status(status).json({ error: resolvedResult.error });
        }
        const resolved = resolvedResult.resolved;

        try {
            await guardSaasStoragePath(resolved);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        await serveProjectBinary(req, res, {
            absPath: resolved,
            download: Boolean(req.query.download),
            cacheMode: 'media',
        });

    } catch (error) {
        console.error('Error serving binary file:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// PD-SAAS-FORK: thumbnail API for progressive project image previews.
app.get('/api/projects/:projectName/files/thumbnail', authenticateToken, requestBackpressure('thumbnail'), async (req, res) => {
    try {
        const { projectName } = req.params;
        const { path: filePath, hintDir } = req.query;

        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        const thumbResolveOptions = {};
        if (typeof hintDir === 'string' && hintDir.trim()) {
            thumbResolveOptions.hintDir = hintDir.trim();
        }
        if (knownRoots.length === 0) {
            if (thumbResolveOptions.hintDir) {
                knownRoots = [path.join(projectRoot, thumbResolveOptions.hintDir.replace(/\\/g, '/'))];
            } else {
                await warmProjectDirectoryForDeliverables(projectName);
                knownRoots = await getDeliverableSearchRootsForProject(projectName);
            }
        }

        const resolvedResult = resolveExistingProjectFilePath(projectRoot, filePath, knownRoots, thumbResolveOptions);
        if (!resolvedResult.valid) {
            const status = resolvedResult.error === 'File not found' ? 404 : 403;
            return res.status(status).json({ error: resolvedResult.error });
        }
        const resolved = resolvedResult.resolved;

        try {
            await guardSaasStoragePath(resolved);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        if (!isSupportedThumbnailSource(resolved)) {
            res.setHeader('X-Thumbnail-Fallback', 'content');
            return res.status(404).json({ error: 'Thumbnail is not available for this file type' });
        }

        let thumbnail;
        try {
            thumbnail = await createProjectThumbnail({
                sourcePath: resolved,
                cacheRoot: path.join(getDataRoot(), '.cache', 'thumbnails'),
                options: normalizeThumbnailOptions(req.query),
            });
        } catch (thumbError) {
            console.warn('[thumbnail] generation failed, client may fallback to content:', thumbError?.message || thumbError);
            res.setHeader('X-Thumbnail-Fallback', 'content');
            const code = thumbError?.code === 'UNSUPPORTED_THUMBNAIL_SOURCE'
                || thumbError?.code === 'INVALID_THUMBNAIL_SOURCE'
                ? 404
                : 503;
            return res.status(code).json({
                error: thumbError?.message || 'Thumbnail generation failed',
                fallback: 'content',
            });
        }
        res.setHeader('Content-Type', thumbnail.contentType);
        applyProjectMediaCacheHeaders(res, thumbnail.path);

        const stream = streamThumbnailFile(thumbnail.path);
        stream.pipe(res);
        stream.on('error', (error) => {
            console.error('Error streaming thumbnail:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error reading thumbnail' });
            }
        });
    } catch (error) {
        console.error('Error serving thumbnail:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Serve project files through a stable project-root URL so generated HTML can
// load sibling CSS, JS and image assets with normal relative paths.
app.get('/api/projects/:projectName/preview/*', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const relativeFilePath = req.params[0] || 'index.html';
        const hintDir = typeof req.query.hintDir === 'string' ? req.query.hintDir.trim() : '';

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const previewResolveOptions = hintDir ? { hintDir } : {};
        const resolvedResult = resolveExistingProjectFilePath(
            projectRoot,
            relativeFilePath,
            knownRoots,
            previewResolveOptions,
        );
        if (!resolvedResult.valid) {
            return res.status(403).json({ error: resolvedResult.error });
        }

        let resolved = resolvedResult.resolved;
        let stats = await fsPromises.stat(resolved).catch(() => null);
        if (stats?.isDirectory()) {
            resolved = path.join(resolved, 'index.html');
            stats = await fsPromises.stat(resolved).catch(() => null);
        }

        if (!stats || !stats.isFile()) {
            return res.status(404).type('text/plain').send('Preview file not found.');
        }

        try {
            await guardSaasStoragePath(resolved);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        applyProjectPreviewCacheHeaders(res, resolved);
        setPreviewContentType(res, resolved);
        // PD-SAAS-FORK VAP P0-0: optional rewrite relative asset URLs with preview ?token= (dev default on).
        const previewToken = typeof req.query.token === 'string' ? req.query.token : null;
        const rewritePreviewAssets = process.env.PILOTDECK_PREVIEW_REWRITE_ASSET_URLS !== '0';
        if (rewritePreviewAssets && previewToken && /\.html?$/i.test(resolved)) {
            let html = await fsPromises.readFile(resolved, 'utf8');
            html = html.replace(
                /(\b(?:src|href)=["'])((?!https?:|data:|\/api\/)[^"']+)(["'])/giu,
                (match, prefix, target, suffix) => {
                    if (/[?&]token=/iu.test(target)) return match;
                    const joiner = target.includes('?') ? '&' : '?';
                    return `${prefix}${target}${joiner}token=${encodeURIComponent(previewToken)}${suffix}`;
                },
            );
            res.send(html);
            return;
        }
        fs.createReadStream(resolved).pipe(res);
    } catch (error) {
        console.error('Error serving project preview:', error);
        res.status(500).json({ error: error.message });
    }
});

// PD-SAAS-FORK: Markdown 公开分享 — 鉴权 CRUD + 公开 /s/:id + 旧链废弃页
const markdownShareDeps = {
    extractProjectDirectory,
    getDeliverableSearchRootsForProject,
    warmProjectDirectoryForDeliverables,
    resolveExistingProjectFilePath,
    guardSaasStoragePath,
};

registerMarkdownShareAuthRoutes(app, authenticateToken, markdownShareDeps);
registerLegacyMarkdownShareDeprecation(app, authenticateToken);
registerMarkdownSharePublicRoutes(app, markdownShareDeps);

// Download the complete project as a zip archive.
app.get('/api/projects/:projectName/download', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const rootStats = await fsPromises.stat(projectRoot).catch(() => null);
        if (!rootStats?.isDirectory()) {
            return res.status(404).json({ error: 'Project directory not found' });
        }

        try {
            await guardSaasStoragePath(projectRoot);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        const zip = new JSZip();
        await addDirectoryToZip(zip, projectRoot, projectRoot);

        const filename = getSafeZipFilename(projectName);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', contentDispositionAttachment(filename));

        const zipStream = zip.generateNodeStream({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });
        zipStream.on('error', (error) => {
            console.error('Error streaming project zip:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate project archive' });
            } else {
                res.end();
            }
        });
        zipStream.pipe(res);
    } catch (error) {
        console.error('Error downloading project archive:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Save file content endpoint
app.put('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
    try {
        const { projectName } = req.params;
        const { filePath, content } = req.body;

        if (saasBlocksUserFileMutationForPath(filePath)) {
            return res.status(403).json({
                error: 'File changes in SaaS are created through chat. Use download to save files locally.',
            });
        }


        // Security: ensure the requested path is inside the project root
        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        if (content === undefined) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        let knownRoots = await getDeliverableSearchRootsForProject(projectName);
        if (knownRoots.length === 0) {
            await warmProjectDirectoryForDeliverables(projectName);
            knownRoots = await getDeliverableSearchRootsForProject(projectName);
        }

        const resolvedResult = resolveExistingProjectFilePath(projectRoot, filePath, knownRoots);
        let resolved;
        if (!resolvedResult.valid) {
            if (
                resolvedResult.error === 'File not found'
                && (isDesignCanvasBoardWritePath(filePath) || isHtmlDeliverableWritePath(filePath) || isHfStudioWritePath(filePath) || isBentoDeckWritePath(filePath))
            ) {
                const validation = validatePathInProject(projectRoot, filePath);
                if (!validation.valid) {
                    return res.status(403).json({ error: validation.error });
                }
                resolved = validation.resolved;
                const parentDir = path.dirname(resolved);
                await fsPromises.mkdir(parentDir, { recursive: true });
            } else {
                const status = resolvedResult.error === 'File not found' ? 404 : 403;
                return res.status(status).json({ error: resolvedResult.error });
            }
        } else {
            resolved = resolvedResult.resolved;
        }

        let beforeContent = '';
        if (isBentoDeckWritePath(filePath)) {
            try {
                beforeContent = await fsPromises.readFile(resolved, 'utf8');
            } catch {
                beforeContent = '';
            }
            const validation = validateBentoDeckWrite(beforeContent, content);
            if (!validation.ok) {
                return res.status(403).json({ error: validation.error });
            }
        }

        if (isHtmlDeliverableWritePath(filePath)) {
            try {
                beforeContent = await fsPromises.readFile(resolved, 'utf8');
            } catch {
                beforeContent = '';
            }
            const validation = validateHtmlDeliverableWrite(beforeContent, content);
            if (!validation.ok) {
                return res.status(403).json({ error: validation.error });
            }
        }

        if (isHfStudioWritePath(filePath)) {
            const validation = validateHfStudioWrite(content);
            if (!validation.ok) {
                return res.status(403).json({ error: validation.error });
            }
        }

        // Write the new content (atomic for canvas manifest recovery)
        const isCanvasManifest = /canvas-manifest\.json$/i.test(String(filePath || ''));
        if (isCanvasManifest) {
            await atomicWriteTextFile(resolved, content);
        } else {
            await fsPromises.writeFile(resolved, content, 'utf8');
        }

        if (isBentoDeckWritePath(filePath)) {
            const ctx = getSaasRequestContext();
            await appendBentoDeckWriteAudit(getDataRoot(), {
                tenantId: ctx?.tenantId ?? null,
                userId: ctx?.userId ?? null,
                path: String(filePath || ''),
                sha256: bentoSha256ContentHex(content),
            }).catch((auditError) => {
                console.warn('[bento-deck] audit write failed:', auditError?.message || auditError);
            });
        }

        if (isHtmlDeliverableWritePath(filePath)) {
            const ctx = getSaasRequestContext();
            await appendHtmlStudioWriteAudit(getDataRoot(), {
                tenantId: ctx?.tenantId ?? null,
                userId: ctx?.userId ?? null,
                path: String(filePath || ''),
                sha256: sha256ContentHex(content),
            }).catch((auditError) => {
                console.warn('[html-studio] audit write failed:', auditError?.message || auditError);
            });
        }

        if (isHfStudioWritePath(filePath)) {
            const ctx = getSaasRequestContext();
            await appendHfStudioWriteAudit(getDataRoot(), {
                tenantId: ctx?.tenantId ?? null,
                userId: ctx?.userId ?? null,
                path: String(filePath || ''),
                sha256: hfSha256ContentHex(content),
            }).catch((auditError) => {
                console.warn('[hf-studio] audit write failed:', auditError?.message || auditError);
            });
        }

        res.json({
            success: true,
            path: resolved,
            relativePath: path.relative(projectRoot, resolved).split(path.sep).join('/'),
            message: 'File saved successfully'
        });
    } catch (error) {
        console.error('Error saving file:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File or directory not found' });
        } else if (error.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// PD-SAAS-FORK: HyperFrames Studio render API
app.post('/api/projects/:projectName/hyperframes/render', authenticateToken, async (req, res) => {
    try {
        if (saasBlocksUserFileMutationForPath(req.body?.projectDir)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const projectRoot = await extractProjectDirectory(req.params.projectName);
        const job = await createHfRenderJob(projectRoot, req.body ?? {});
        res.json(job);
    } catch (error) {
        if (error.status === 503) {
            res.set('Retry-After', String(error.retryAfter ?? 5));
            return res.status(503).json({ error: error.message, retryAfter: error.retryAfter ?? 5 });
        }
        const status = error.status ?? 500;
        res.status(status).json({ error: error.message || 'render_failed' });
    }
});

app.get('/api/projects/:projectName/hyperframes/render/:jobId', authenticateToken, async (req, res) => {
    const job = getHfRenderJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
});

app.get('/api/projects/:projectName/hyperframes/doctor', authenticateToken, async (req, res) => {
    try {
        const projectDir = String(req.query.projectDir ?? '');
        if (!projectDir) {
            return res.status(400).json({ error: 'projectDir required' });
        }
        const projectRoot = await extractProjectDirectory(req.params.projectName);
        const result = await runHfDoctor(projectDir, projectRoot);
        res.json(result);
    } catch (error) {
        const status = error.status ?? 500;
        res.status(status).json({ error: error.message || 'doctor_failed' });
    }
});

app.get('/api/projects/:projectName/files', authenticateToken, async (req, res) => {
    try {

        // Using fsPromises from import

        // Use extractProjectDirectory to get the actual project path
        let actualPath;
        try {
            actualPath = await extractProjectDirectory(req.params.projectName);
        } catch (error) {
            console.error('Error extracting project directory:', error);
            // Fallback to simple dash replacement
            actualPath = req.params.projectName.replace(/-/g, '/');
        }

        // Check if path exists
        try {
            await fsPromises.access(actualPath);
        } catch (e) {
            return res.status(404).json({ error: `Project path not found: ${actualPath}` });
        }

        try {
            await guardSaasStoragePath(actualPath);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        const files = await getFileTree(actualPath, 10, 0, true);
        res.json(relativizeFileTreeNodes(files, actualPath));
    } catch (error) {
        console.error('[ERROR] File tree error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:projectName/files/list?path=<relativeDir>
// Shallow listing of a single directory with project-relative paths, used by the
// chat deliverable folder browser to render a thumbnail grid without loading the
// whole project tree.
app.get('/api/projects/:projectName/files/list', authenticateToken, async (req, res) => {
    try {
        let root;
        try {
            root = await extractProjectDirectory(req.params.projectName);
        } catch (error) {
            return res.status(404).json({ error: 'Project path not found' });
        }

        const relativeDir = String(req.query.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const targetDir = relativeDir ? path.resolve(root, relativeDir) : path.resolve(root);
        const normalizedRoot = path.resolve(root);
        if (targetDir !== normalizedRoot && !targetDir.startsWith(normalizedRoot + path.sep)) {
            return res.status(400).json({ error: 'Path must be under project root' });
        }

        try {
            const stats = await fsPromises.stat(targetDir);
            if (!stats.isDirectory()) {
                return res.status(400).json({ error: 'Path is not a directory' });
            }
        } catch (e) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        try {
            await guardSaasStoragePath(targetDir);
        } catch (error) {
            return storagePathForbiddenResponse(res, error);
        }

        const tree = await getFileTree(targetDir, 1, 0, true);
        const entries = tree.map((item) => ({
            name: item.name,
            type: item.type,
            size: item.size ?? 0,
            modified: item.modified ?? null,
            relativePath: path.relative(normalizedRoot, item.path).split(path.sep).join('/'),
        }));
        res.json({ dir: relativeDir, entries });
    } catch (error) {
        console.error('[ERROR] File list error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// FILE OPERATIONS API ENDPOINTS
// ============================================================================

/**
 * Validate that a path is within the project root
 * @param {string} projectRoot - The project root path
 * @param {string} targetPath - The path to validate
 * @returns {{ valid: boolean, resolved?: string, error?: string }}
 */
function validatePathInProject(projectRoot, targetPath) {
    const resolved = path.isAbsolute(targetPath)
        ? path.resolve(targetPath)
        : path.resolve(projectRoot, targetPath);
    const normalizedRoot = path.resolve(projectRoot) + path.sep;
    if (!resolved.startsWith(normalizedRoot)) {
        return { valid: false, error: 'Path must be under project root' };
    }
    return { valid: true, resolved };
}

/**
 * Validate filename - check for invalid characters
 * @param {string} name - The filename to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFilename(name) {
    if (!name || !name.trim()) {
        return { valid: false, error: 'Filename cannot be empty' };
    }
    // Check for invalid characters (Windows + Unix)
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
        return { valid: false, error: 'Filename contains invalid characters' };
    }
    // Check for reserved names (Windows)
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reserved.test(name)) {
        return { valid: false, error: 'Filename is a reserved name' };
    }
    // Check for dots only
    if (/^\.+$/.test(name)) {
        return { valid: false, error: 'Filename cannot be only dots' };
    }
    return { valid: true };
}

// POST /api/projects/:projectName/files/create - Create new file or directory
app.post('/api/projects/:projectName/files/create', authenticateToken, async (req, res) => {
    try {
        const { path: parentPath, type, name } = req.body;
        const targetPath = parentPath ? path.join(parentPath, name || '') : (name || '');
        if (saasBlocksUserFileMutationForPath(targetPath)) {
            return res.status(403).json({
                error: 'File changes in SaaS are created through chat. Use download to save files locally.',
            });
        }
        const { projectName } = req.params;

        // Validate input
        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        if (!['file', 'directory'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "file" or "directory"' });
        }

        const nameValidation = validateFilename(name);
        if (!nameValidation.valid) {
            return res.status(400).json({ error: nameValidation.error });
        }

        // Get project root
        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Build and validate target path
        const targetDir = parentPath || '';
        const validation = validatePathInProject(projectRoot, targetPath);
        if (!validation.valid) {
            return res.status(403).json({ error: validation.error });
        }

        const resolvedPath = validation.resolved;

        // Check if already exists
        try {
            await fsPromises.access(resolvedPath);
            return res.status(409).json({ error: `${type === 'file' ? 'File' : 'Directory'} already exists` });
        } catch {
            // Doesn't exist, which is what we want
        }

        // Create file or directory
        if (type === 'directory') {
            await fsPromises.mkdir(resolvedPath, { recursive: false });
        } else {
            // Ensure parent directory exists
            const parentDir = path.dirname(resolvedPath);
            try {
                await fsPromises.access(parentDir);
            } catch {
                await fsPromises.mkdir(parentDir, { recursive: true });
            }
            await fsPromises.writeFile(resolvedPath, '', 'utf8');
        }

        res.json({
            success: true,
            path: resolvedPath,
            name,
            type,
            message: `${type === 'file' ? 'File' : 'Directory'} created successfully`
        });
    } catch (error) {
        console.error('Error creating file/directory:', error);
        if (error.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        } else if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Parent directory not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// PUT /api/projects/:projectName/files/rename - Rename file or directory
app.put('/api/projects/:projectName/files/rename', authenticateToken, async (req, res) => {
    try {
        if (saasBlocksUserFileMutation()) {
            return res.status(403).json({
                error: 'File changes in SaaS are created through chat. Use download to save files locally.',
            });
        }
        const { projectName } = req.params;
        const { oldPath, newName } = req.body;

        // Validate input
        if (!oldPath || !newName) {
            return res.status(400).json({ error: 'oldPath and newName are required' });
        }

        const nameValidation = validateFilename(newName);
        if (!nameValidation.valid) {
            return res.status(400).json({ error: nameValidation.error });
        }

        // Get project root
        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Validate old path
        const oldValidation = validatePathInProject(projectRoot, oldPath);
        if (!oldValidation.valid) {
            return res.status(403).json({ error: oldValidation.error });
        }

        const resolvedOldPath = oldValidation.resolved;

        // Check if old path exists
        try {
            await fsPromises.access(resolvedOldPath);
        } catch {
            return res.status(404).json({ error: 'File or directory not found' });
        }

        // Build and validate new path
        const parentDir = path.dirname(resolvedOldPath);
        const resolvedNewPath = path.join(parentDir, newName);
        const newValidation = validatePathInProject(projectRoot, resolvedNewPath);
        if (!newValidation.valid) {
            return res.status(403).json({ error: newValidation.error });
        }

        // Check if new path already exists
        try {
            await fsPromises.access(resolvedNewPath);
            return res.status(409).json({ error: 'A file or directory with this name already exists' });
        } catch {
            // Doesn't exist, which is what we want
        }

        // Rename
        await fsPromises.rename(resolvedOldPath, resolvedNewPath);

        res.json({
            success: true,
            oldPath: resolvedOldPath,
            newPath: resolvedNewPath,
            newName,
            message: 'Renamed successfully'
        });
    } catch (error) {
        console.error('Error renaming file/directory:', error);
        if (error.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        } else if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File or directory not found' });
        } else if (error.code === 'EXDEV') {
            res.status(400).json({ error: 'Cannot move across different filesystems' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// DELETE /api/projects/:projectName/files - Delete file or directory
app.delete('/api/projects/:projectName/files', authenticateToken, async (req, res) => {
    try {
        if (saasBlocksUserFileMutation()) {
            return res.status(403).json({
                error: 'File changes in SaaS are created through chat. Use download to save files locally.',
            });
        }
        const { projectName } = req.params;
        const { path: targetPath, type } = req.body;

        // Validate input
        if (!targetPath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        // Get project root
        const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
        if (!projectRoot) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Validate path
        const validation = validatePathInProject(projectRoot, targetPath);
        if (!validation.valid) {
            return res.status(403).json({ error: validation.error });
        }

        const resolvedPath = validation.resolved;

        // Check if path exists and get stats
        let stats;
        try {
            stats = await fsPromises.stat(resolvedPath);
        } catch {
            return res.status(404).json({ error: 'File or directory not found' });
        }

        // Prevent deleting the project root itself
        if (resolvedPath === path.resolve(projectRoot)) {
            return res.status(403).json({ error: 'Cannot delete project root directory' });
        }

        // Delete based on type
        if (stats.isDirectory()) {
            await fsPromises.rm(resolvedPath, { recursive: true, force: true });
        } else {
            await fsPromises.unlink(resolvedPath);
        }

        res.json({
            success: true,
            path: resolvedPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            message: 'Deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file/directory:', error);
        if (error.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        } else if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File or directory not found' });
        } else if (error.code === 'ENOTEMPTY') {
            res.status(400).json({ error: 'Directory is not empty' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// POST /api/projects/:projectName/files/upload - Upload files
// Dynamic import of multer for file uploads
const uploadFilesHandler = async (req, res) => {
    // Dynamic import of multer
    const multer = (await import('multer')).default;

    const uploadMiddleware = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, os.tmpdir());
            },
            filename: (req, file, cb) => {
                // Use a unique temp name, but preserve original name in file.originalname
                // Note: file.originalname may contain path separators for folder uploads
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                // For temp file, just use a safe unique name without the path
                cb(null, `upload-${uniqueSuffix}`);
            }
        }),
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB limit
            files: 20 // Max 20 files at once
        }
    });

    // Use multer middleware
    uploadMiddleware.array('files', 20)(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'Too many files. Maximum is 20 files.' });
            }
            return res.status(500).json({ error: err.message });
        }

        try {
            const { projectName } = req.params;
            const { targetPath, relativePaths } = req.body;

            // Parse relative paths if provided (for folder uploads)
            let filePaths = [];
            if (relativePaths) {
                try {
                    filePaths = JSON.parse(relativePaths);
                } catch (e) {
                    console.log('[DEBUG] Failed to parse relativePaths:', relativePaths);
                }
            }

            const canvasUploadAllowed =
                isDesignCanvasBoardWritePath(targetPath || '')
                || filePaths.some((entry) => isDesignCanvasBoardWritePath(String(entry || '')));
            if (saasBlocksUserFileMutation() && !canvasUploadAllowed) {
                return res.status(403).json({
                    error: 'File changes in SaaS are created through chat. Use download to save files locally.',
                });
            }

            console.log('[DEBUG] File upload request:', {
                projectName,
                targetPath: JSON.stringify(targetPath),
                targetPathType: typeof targetPath,
                filesCount: req.files?.length,
                relativePaths: filePaths
            });

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files provided' });
            }

            // Get project root
            const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
            if (!projectRoot) {
                return res.status(404).json({ error: 'Project not found' });
            }

            console.log('[DEBUG] Project root:', projectRoot);

            // Validate and resolve target path
            // If targetPath is empty or '.', use project root directly
            const targetDir = targetPath || '';
            let resolvedTargetDir;

            console.log('[DEBUG] Target dir:', JSON.stringify(targetDir));

            if (!targetDir || targetDir === '.' || targetDir === './') {
                // Empty path means upload to project root
                resolvedTargetDir = path.resolve(projectRoot);
                console.log('[DEBUG] Using project root as target:', resolvedTargetDir);
            } else {
                const validation = validatePathInProject(projectRoot, targetDir);
                if (!validation.valid) {
                    console.log('[DEBUG] Path validation failed:', validation.error);
                    return res.status(403).json({ error: validation.error });
                }
                resolvedTargetDir = validation.resolved;
                console.log('[DEBUG] Resolved target dir:', resolvedTargetDir);
            }

            // Ensure target directory exists
            try {
                await fsPromises.access(resolvedTargetDir);
            } catch {
                await fsPromises.mkdir(resolvedTargetDir, { recursive: true });
            }

            // Move uploaded files from temp to target directory
            const uploadedFiles = [];
            console.log('[DEBUG] Processing files:', req.files.map(f => ({ originalname: f.originalname, path: f.path })));
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                // Use relative path if provided (for folder uploads), otherwise use originalname
                const fileName = (filePaths && filePaths[i]) ? filePaths[i] : file.originalname;
                console.log('[DEBUG] Processing file:', fileName, '(originalname:', file.originalname + ')');
                const destPath = path.join(resolvedTargetDir, fileName);

                // Validate destination path
                const destValidation = validatePathInProject(projectRoot, destPath);
                if (!destValidation.valid) {
                    console.log('[DEBUG] Destination validation failed for:', destPath);
                    // Clean up temp file
                    await fsPromises.unlink(file.path).catch(() => {});
                    continue;
                }

                // Ensure parent directory exists (for nested files from folder upload)
                const parentDir = path.dirname(destPath);
                try {
                    await fsPromises.access(parentDir);
                } catch {
                    await fsPromises.mkdir(parentDir, { recursive: true });
                }

                // Move file (copy + unlink to handle cross-device scenarios)
                await fsPromises.copyFile(file.path, destPath);
                await fsPromises.unlink(file.path);

                uploadedFiles.push({
                    name: fileName,
                    path: destPath,
                    size: file.size,
                    mimeType: file.mimetype
                });
            }

            res.json({
                success: true,
                files: uploadedFiles,
                targetPath: resolvedTargetDir,
                message: `Uploaded ${uploadedFiles.length} file(s) successfully`
            });
        } catch (error) {
            console.error('Error uploading files:', error);
            // Clean up any remaining temp files
            if (req.files) {
                for (const file of req.files) {
                    await fsPromises.unlink(file.path).catch(() => {});
                }
            }
            if (error.code === 'EACCES') {
                res.status(403).json({ error: 'Permission denied' });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });
};

app.post('/api/projects/:projectName/files/upload', authenticateToken, uploadFilesHandler);

/**
 * Proxy an authenticated client WebSocket to a plugin's internal WS server.
 * Auth is enforced by verifyClient before this function is reached.
 */
function handlePluginWsProxy(clientWs, pathname) {
    const pluginName = pathname.replace('/plugin-ws/', '');
    if (!pluginName || /[^a-zA-Z0-9_-]/.test(pluginName)) {
        clientWs.close(4400, 'Invalid plugin name');
        return;
    }

    const port = getPluginPort(pluginName);
    if (!port) {
        clientWs.close(4404, 'Plugin not running');
        return;
    }

    const upstream = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    upstream.on('open', () => {
        console.log(`[Plugins] WS proxy connected to "${pluginName}" on port ${port}`);
    });

    // Relay messages bidirectionally
    upstream.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
    });
    clientWs.on('message', (data) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    });

    // Propagate close in both directions
    upstream.on('close', () => { if (clientWs.readyState === WebSocket.OPEN) clientWs.close(); });
    clientWs.on('close', () => { if (upstream.readyState === WebSocket.OPEN) upstream.close(); });

    upstream.on('error', (err) => {
        console.error(`[Plugins] WS proxy error for "${pluginName}":`, err.message);
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(4502, 'Upstream error');
    });
    clientWs.on('error', () => {
        if (upstream.readyState === WebSocket.OPEN) upstream.close();
    });
}

// WebSocket connection handler that routes based on URL path
wss.on('connection', (ws, request) => {
    const url = request.url;
    console.log('[INFO] Client connected to:', url);

    // Parse URL to get pathname without query parameters
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;

    if (pathname === '/shell') {
        handleShellConnection(ws);
    } else if (pathname === '/ws') {
        handleChatConnection(ws, request);
    } else if (pathname.startsWith('/plugin-ws/')) {
        handlePluginWsProxy(ws, pathname);
    } else {
        console.log('[WARN] Unknown WebSocket path:', pathname);
        ws.close();
    }
});

/**
 * WebSocket Writer - Wrapper for WebSocket to match SSEStreamWriter interface
 *
 * Provider files use `createNormalizedMessage()` from `providers/types.js` and
 * adapter `normalizeMessage()` to produce unified NormalizedMessage events.
 * The writer simply serialises and sends.
 */
class WebSocketWriter {
    constructor(ws, userId = null) {
        this.ws = ws;
        this.sessionId = null;
        this.userId = userId;
        this.isWebSocketWriter = true;  // Marker for transport detection
    }

    send(data) {
        const message = JSON.stringify(data);
        if (this.ws.readyState === 1) { // WebSocket.OPEN
            this.ws.send(message);
            return;
        }

        // A chat turn can outlive the browser WebSocket that submitted it
        // (refresh, reconnect, dev-client hiccup). Keep the gateway stream live
        // by handing subsequent frames to the user's replacement connection.
        connectedClients.forEach((client) => {
            if (client.readyState !== 1) return; // WebSocket.OPEN
            if (client.__pilotdeckUserId !== this.userId) return;
            client.send(message);
        });
    }

    updateWebSocket(newRawWs) {
        this.ws = newRawWs;
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    getSessionId() {
        return this.sessionId;
    }
}

// Handle chat WebSocket connections
function handleChatConnection(ws, request) {
    console.log('[INFO] Chat WebSocket connected');

    // Add to connected clients for project updates
    const userId = request?.user?.id ?? request?.user?.userId ?? null;
    ws.__pilotdeckUserId = userId;
    ws.__pilotdeckTenantId = request?.user?.tenant_id ?? request?.user?.tenantId ?? null;
    ws.__pilotdeckRole = typeof request?.user?.role === 'string' ? request.user.role : null;
    connectedClients.add(ws);
    // PilotDeck's cron runtime lives inside `pilotdeck server`
    // (src/cron via createCronRuntime); no legacy daemon lease needed.
    let cleanedUp = false;

    // PD-SAAS-FORK: bind the connection's tenant so gateway-backed turns
    // (writes) stay inside the tenant transcript boundary. Unlike REST,
    // WebSocket handling does not pass through `authenticateToken`, so the
    // tenant ALS context must be re-established here from the verified user.
    const wsTenantId = ws.__pilotdeckTenantId;
    const runWithTenant = (fn) => {
        if (IS_SAAS_MODE && wsTenantId) {
            return saasRequestStore.run(
                { tenantId: wsTenantId, tenantPilotHome: getTenantPilotHome(wsTenantId), userId },
                fn,
            );
        }
        return fn();
    };

    // Wrap WebSocket with writer for consistent interface with SSEStreamWriter
    const writer = new WebSocketWriter(ws, userId);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'ping') return;

            if (data.type === 'always-on-presence') {
                await alwaysOnHeartbeat.handlePresence(ws, data);
            } else if (data.type === 'always-on-presence-clear') {
                await alwaysOnHeartbeat.clearPresence(ws);
            } else if (
                data.type === 'pilotdeck-command' ||
                // Deprecated: legacy per-provider frame types kept for back-compat.
                data.type === 'claude-command' ||
                data.type === 'cursor-command' ||
                data.type === 'codex-command' ||
                data.type === 'gemini-command'
            ) {
                console.log('[DEBUG] User message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.projectPath || data.options?.cwd || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
                const providerHint = data.options?.providerHint || data.type.replace('-command', '');
                // PD-SAAS-FORK: Soft quota gate before agent turn (402 semantics over WS).
                if (IS_SAAS_MODE && userId) {
                    const quota = await checkChatQuota(userId);
                    if (!quota.ok) {
                        const sessionId = data.options?.sessionId || '';
                        writer.send(createNormalizedMessage({
                            kind: 'text',
                            type: 'error',
                            content: quota.message,
                            sessionId,
                            provider: providerHint,
                        }));
                        writer.send(createNormalizedMessage({
                            kind: 'complete',
                            exitCode: 0,
                            success: true,
                            sessionId,
                            provider: providerHint,
                        }));
                        return;
                    }
                }
                if (IS_SAAS_MODE && userId && isTurnQueueEnabled()) {
                    await runWithTenant(async () => {
                        await acceptTurn({
                            command: data.command,
                            options: data.options,
                            writer,
                            providerHint,
                            userId,
                            role: ws.__pilotdeckRole,
                            tenantId: wsTenantId,
                            sessionStates: getBridgeSessionStateSnapshot(),
                            consumeCredit: async () => {
                                await consumeCredit(userId, 1, 'chat_turn');
                            },
                        });
                    });
                    return;
                }
                if (IS_SAAS_MODE && userId) {
                    await consumeCredit(userId, 1, 'chat_turn');
                }
                const turnGate = evaluateTurnConcurrencyGate({
                    userId,
                    role: ws.__pilotdeckRole,
                    command: data.command,
                    options: data.options,
                    sessionStates: getBridgeSessionStateSnapshot(),
                });
                if (!turnGate.allowed) {
                    const sessionId = data.options?.sessionId || '';
                    writer.send({
                        type: 'turn_rejected',
                        reason: turnGate.reason,
                        activeCount: turnGate.activeCount,
                        limit: turnGate.limit,
                        retryable: true,
                        sessionId,
                        provider: providerHint,
                    });
                    return;
                }
                await runWithTenant(() =>
                    runChatViaGateway(data.command, data.options, writer, providerHint),
                );
            } else if (data.type === 'abort-session') {
                console.log('[DEBUG] Abort session request:', data.sessionId);
                const provider = data.provider || 'pilotdeck';
                if (IS_SAAS_MODE && userId && isTurnQueueEnabled() && (data.reason === 'user_pause' || data.pause === true)) {
                    await runWithTenant(() => pauseTurn({
                        sessionId: data.sessionId,
                        userId,
                        tenantId: wsTenantId,
                        role: ws.__pilotdeckRole,
                        reason: 'user_stop',
                        writer,
                    }));
                    return;
                }
                const success = await abortViaGateway(data.sessionId, provider);
                writer.send(createNormalizedMessage({ kind: 'complete', exitCode: success ? 0 : 1, aborted: true, success, sessionId: data.sessionId, provider }));
            } else if (data.type === 'pause-turn') {
                if (IS_SAAS_MODE && userId && data.sessionId) {
                    if (isTurnQueueEnabled()) {
                        await runWithTenant(() => pauseTurn({
                            sessionId: data.sessionId,
                            userId,
                            tenantId: wsTenantId,
                            role: ws.__pilotdeckRole,
                            reason: data.reason || 'user_pause',
                            writer,
                        }));
                    } else {
                        const provider = data.provider || 'pilotdeck';
                        await abortViaGateway(data.sessionId, provider);
                        writer.send(createNormalizedMessage({
                            kind: 'complete',
                            exitCode: 0,
                            success: true,
                            aborted: true,
                            userAborted: true,
                            sessionId: data.sessionId,
                            provider,
                        }));
                    }
                }
            } else if (data.type === 'unpause-session') {
                if (IS_SAAS_MODE && userId && data.sessionId && isTurnQueueEnabled()) {
                    await runWithTenant(() => unpauseSession({
                        sessionId: data.sessionId,
                        userId,
                        tenantId: wsTenantId,
                        role: ws.__pilotdeckRole,
                        reason: data.reason || 'user_unmark_complete',
                        writer,
                    }));
                }
            } else if (data.type === 'repair-turn-queue') {
                if (IS_SAAS_MODE && userId && isTurnQueueEnabled()) {
                    await runWithTenant(async () => {
                        const result = await repairUserTurnQueue({
                            tenantId: wsTenantId,
                            userId,
                            role: ws.__pilotdeckRole ?? null,
                        });
                        writer.send({
                            type: 'turn_queue_repaired',
                            ...result,
                            provider: 'pilotdeck',
                        });
                    });
                }
            } else if (data.type === 'cancel-queued-turn') {
                if (IS_SAAS_MODE && userId && isTurnQueueEnabled()) {
                    await runWithTenant(() => cancelQueuedTurnRequest({
                        sessionId: data.sessionId,
                        userId,
                        tenantId: wsTenantId,
                        writer,
                    }));
                }
            } else if (data.type === 'permission-response') {
                if (data.requestId) {
                    await decidePermissionViaGateway(
                        data.requestId,
                        data.allow ? 'allow' : 'deny',
                        {
                            remember: Boolean(data.rememberEntry),
                            reason: data.message,
                        },
                    );
                }
            } else if (data.type === 'session-permission-grant') {
                await grantSessionPermissionViaGateway(data.sessionId, data.entry);
            } else if (data.type === 'elicitation-response') {
                if (data.requestId) {
                    await elicitationRespondViaGateway(data.requestId, data.answer);
                }
            } else if (data.type === 'check-session-status') {
                const sessionId = data.sessionId;
                const isProcessing = isSessionActiveViaGateway(sessionId);
                const activeTurnMessages = isProcessing
                    ? await getActiveTurnSnapshotFramesViaGateway(sessionId, data.provider || 'pilotdeck')
                    : [];
                writer.send({
                    type: 'session-status',
                    sessionId,
                    provider: data.provider || 'pilotdeck',
                    isProcessing,
                    activeTurnMessages,
                    tokenBudget: getSessionTokenBudget(sessionId),
                });
            } else if (data.type === 'get-pending-permissions') {
                // Pending-permission introspection is gateway-internal. The
                // permission_request event already contains everything the
                // UI needs, so the response is now an empty stub.
                writer.send({
                    type: 'pending-permissions-response',
                    sessionId: data.sessionId,
                    data: [],
                });
            } else if (data.type === 'get-active-sessions') {
                const ids = getActiveSessionIdsViaGateway();
                // Keep the four-provider keys so the legacy UI store does
                // not need to change shape; everything routes through
                // PilotDeck under the hood.
                writer.send({
                    type: 'active-sessions',
                    sessions: { claude: ids, cursor: [], codex: [], gemini: [], pilotdeck: ids },
                });
            }
        } catch (error) {
            console.error('[ERROR] Chat WebSocket error:', error.message);
            writer.send({
                type: 'error',
                error: error.message
            });
        }
    });

    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        // Remove from connected clients
        connectedClients.delete(ws);
        void alwaysOnHeartbeat.clearPresence(ws);
    };

    ws.on('close', (code, reason) => {
        const reasonText = reason?.toString?.() || '';
        console.log(`🔌 Chat client disconnected code=${code}${reasonText ? ` reason=${reasonText}` : ''}`);
        cleanup();
    });
    ws.on('error', () => {
        cleanup();
    });
}

// Handle shell WebSocket connections
function handleShellConnection(ws) {
    console.log('🐚 Shell client connected');
    let shellProcess = null;
    let ptySessionKey = null;
    let urlDetectionBuffer = '';
    const announcedAuthUrls = new Set();

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Shell message received:', data.type);

            if (data.type === 'init') {
                const projectPath = data.projectPath || process.cwd();
                const sessionId = data.sessionId;
                const hasSession = data.hasSession;
                const provider = data.provider || 'pilotdeck';
                const initialCommand = data.initialCommand;
                const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';
                urlDetectionBuffer = '';
                announcedAuthUrls.clear();

                const isLoginCommand = initialCommand && (
                    initialCommand.includes('setup-token') ||
                    initialCommand.includes('cursor-agent login') ||
                    initialCommand.includes('auth login')
                );

                // Include command hash in session key so different commands get separate sessions
                const commandSuffix = isPlainShell && initialCommand
                    ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
                    : '';
                ptySessionKey = `${projectPath}_${sessionId || 'default'}${commandSuffix}`;

                // Kill any existing login session before starting fresh
                if (isLoginCommand) {
                    const oldSession = ptySessionsMap.get(ptySessionKey);
                    if (oldSession) {
                        console.log('🧹 Cleaning up existing login session:', ptySessionKey);
                        if (oldSession.timeoutId) clearTimeout(oldSession.timeoutId);
                        if (oldSession.pty && oldSession.pty.kill) oldSession.pty.kill();
                        ptySessionsMap.delete(ptySessionKey);
                    }
                }

                const existingSession = isLoginCommand ? null : ptySessionsMap.get(ptySessionKey);
                if (existingSession) {
                    console.log('♻️  Reconnecting to existing PTY session:', ptySessionKey);
                    shellProcess = existingSession.pty;

                    clearTimeout(existingSession.timeoutId);

                    ws.send(JSON.stringify({
                        type: 'output',
                        data: `\x1b[36m[Reconnected to existing session]\x1b[0m\r\n`
                    }));

                    if (existingSession.buffer && existingSession.buffer.length > 0) {
                        console.log(`📜 Sending ${existingSession.buffer.length} buffered messages`);
                        existingSession.buffer.forEach(bufferedData => {
                            ws.send(JSON.stringify({
                                type: 'output',
                                data: bufferedData
                            }));
                        });
                    }

                    existingSession.ws = ws;

                    return;
                }

                console.log('[INFO] Starting shell in:', projectPath);
                console.log('📋 Session info:', hasSession ? `Resume session ${sessionId}` : (isPlainShell ? 'Plain shell mode' : 'New session'));
                console.log('🤖 Provider:', isPlainShell ? 'plain-shell' : provider);
                if (initialCommand) {
                    console.log('⚡ Initial command:', initialCommand);
                }

                // First send a welcome message
                let welcomeMsg;
                if (isPlainShell) {
                    welcomeMsg = `\x1b[36mStarting terminal in: ${projectPath}\x1b[0m\r\n`;
                } else {
                    const providerName = provider === 'pilotdeck' ? 'Nova Ai-Studio' : (provider === 'cursor' ? 'Cursor' : (provider === 'codex' ? 'Codex' : (provider === 'gemini' ? 'Gemini' : 'Claude')));
                    welcomeMsg = hasSession ?
                        `\x1b[36mResuming ${providerName} session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
                        `\x1b[36mStarting new ${providerName} session in: ${projectPath}\x1b[0m\r\n`;
                }

                ws.send(JSON.stringify({
                    type: 'output',
                    data: welcomeMsg
                }));

                try {
                    // Validate projectPath — resolve to absolute and verify it exists
                    const resolvedProjectPath = path.resolve(projectPath);
                    try {
                        const stats = fs.statSync(resolvedProjectPath);
                        if (!stats.isDirectory()) {
                            throw new Error('Not a directory');
                        }
                    } catch (pathErr) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid project path' }));
                        return;
                    }

                    // Validate sessionId — only allow safe characters
                    const safeSessionIdPattern = /^[a-zA-Z0-9_.\-:]+$/;
                    if (sessionId && !safeSessionIdPattern.test(sessionId)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid session ID' }));
                        return;
                    }

                    // Build shell command — use cwd for project path (never interpolate into shell string)
                    let shellCommand;
                    if (isPlainShell) {
                        // Plain shell mode - run the initial command in the project directory
                        shellCommand = initialCommand;
                    } else if (provider === 'cursor') {
                        if (hasSession && sessionId) {
                            shellCommand = `cursor-agent --resume="${sessionId}"`;
                        } else {
                            shellCommand = 'cursor-agent';
                        }
                    } else if (provider === 'codex') {
                        // Use codex command; attempt to resume and fall back to a new session when the resume fails.
                        if (hasSession && sessionId) {
                            if (os.platform() === 'win32') {
                                // PowerShell syntax for fallback
                                shellCommand = `codex resume "${sessionId}"; if ($LASTEXITCODE -ne 0) { codex }`;
                            } else {
                                shellCommand = `codex resume "${sessionId}" || codex`;
                            }
                        } else {
                            shellCommand = 'codex';
                        }
                    } else if (provider === 'gemini') {
                        const command = initialCommand || 'gemini';
                        let resumeId = sessionId;
                        if (hasSession && sessionId) {
                            try {
                                // Gemini CLI enforces its own native session IDs, unlike other agents that accept arbitrary string names.
                                // The UI only knows about its internal generated `sessionId` (e.g. gemini_1234).
                                // We must fetch the mapping from the backend session manager to pass the native `cliSessionId` to the shell.
                                const sess = sessionManager.getSession(sessionId);
                                if (sess && sess.cliSessionId) {
                                    resumeId = sess.cliSessionId;
                                    // Validate the looked-up CLI session ID too
                                    if (!safeSessionIdPattern.test(resumeId)) {
                                        resumeId = null;
                                    }
                                }
                            } catch (err) {
                                console.error('Failed to get Gemini CLI session ID:', err);
                            }
                        }

                        if (hasSession && resumeId) {
                            shellCommand = `${command} --resume "${resumeId}"`;
                        } else {
                            shellCommand = command;
                        }
                    } else if (provider === 'pilotdeck') {
                        const command = initialCommand || 'pilotdeck';
                        if (hasSession && sessionId) {
                            if (os.platform() === 'win32') {
                                shellCommand = `pilotdeck --resume "${sessionId}"; if ($LASTEXITCODE -ne 0) { pilotdeck }`;
                            } else {
                                shellCommand = `pilotdeck --resume "${sessionId}" || pilotdeck`;
                            }
                        } else {
                            shellCommand = command;
                        }
                    } else {
                        const command = initialCommand || 'claude';
                        if (hasSession && sessionId) {
                            if (os.platform() === 'win32') {
                                shellCommand = `claude --resume "${sessionId}"; if ($LASTEXITCODE -ne 0) { claude }`;
                            } else {
                                shellCommand = `claude --resume "${sessionId}" || claude`;
                            }
                        } else {
                            shellCommand = command;
                        }
                    }

                    console.log('🔧 Executing shell command:', shellCommand);

                    // Use appropriate shell based on platform
                    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
                    const shellArgs = os.platform() === 'win32' ? ['-Command', shellCommand] : ['-c', shellCommand];

                    // Use terminal dimensions from client if provided, otherwise use defaults
                    const termCols = data.cols || 80;
                    const termRows = data.rows || 24;
                    console.log('📐 Using terminal dimensions:', termCols, 'x', termRows);

                    shellProcess = pty.spawn(shell, shellArgs, {
                        name: 'xterm-256color',
                        cols: termCols,
                        rows: termRows,
                        cwd: resolvedProjectPath,
                        env: {
                            ...process.env,
                            TERM: 'xterm-256color',
                            COLORTERM: 'truecolor',
                            FORCE_COLOR: '3'
                        }
                    });

                    console.log('🟢 Shell process started with PTY, PID:', shellProcess.pid);

                    ptySessionsMap.set(ptySessionKey, {
                        pty: shellProcess,
                        ws: ws,
                        buffer: [],
                        timeoutId: null,
                        projectPath,
                        sessionId
                    });

                    // Handle data output
                    shellProcess.onData((data) => {
                        const session = ptySessionsMap.get(ptySessionKey);
                        if (!session) return;

                        if (session.buffer.length < 5000) {
                            session.buffer.push(data);
                        } else {
                            session.buffer.shift();
                            session.buffer.push(data);
                        }

                        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                            let outputData = data;

                            const cleanChunk = stripAnsiSequences(data);
                            urlDetectionBuffer = `${urlDetectionBuffer}${cleanChunk}`.slice(-SHELL_URL_PARSE_BUFFER_LIMIT);

                            outputData = outputData.replace(
                                /OPEN_URL:\s*(https?:\/\/[^\s\x1b\x07]+)/g,
                                '[INFO] Opening in browser: $1'
                            );

                            const emitAuthUrl = (detectedUrl, autoOpen = false) => {
                                const normalizedUrl = normalizeDetectedUrl(detectedUrl);
                                if (!normalizedUrl) return;

                                const isNewUrl = !announcedAuthUrls.has(normalizedUrl);
                                if (isNewUrl) {
                                    announcedAuthUrls.add(normalizedUrl);
                                    session.ws.send(JSON.stringify({
                                        type: 'auth_url',
                                        url: normalizedUrl,
                                        autoOpen
                                    }));
                                }

                            };

                            const normalizedDetectedUrls = extractUrlsFromText(urlDetectionBuffer)
                                .map((url) => normalizeDetectedUrl(url))
                                .filter(Boolean);

                            // Prefer the most complete URL if shorter prefix variants are also present.
                            const dedupedDetectedUrls = Array.from(new Set(normalizedDetectedUrls)).filter((url, _, urls) =>
                                !urls.some((otherUrl) => otherUrl !== url && otherUrl.startsWith(url))
                            );

                            dedupedDetectedUrls.forEach((url) => emitAuthUrl(url, false));

                            if (shouldAutoOpenUrlFromOutput(cleanChunk) && dedupedDetectedUrls.length > 0) {
                                const bestUrl = dedupedDetectedUrls.reduce((longest, current) =>
                                    current.length > longest.length ? current : longest
                                );
                                emitAuthUrl(bestUrl, true);
                            }

                            // Send regular output
                            session.ws.send(JSON.stringify({
                                type: 'output',
                                data: outputData
                            }));
                        }
                    });

                    // Handle process exit
                    shellProcess.onExit((exitCode) => {
                        console.log('🔚 Shell process exited with code:', exitCode.exitCode, 'signal:', exitCode.signal);
                        const session = ptySessionsMap.get(ptySessionKey);
                        if (session && session.ws && session.ws.readyState === WebSocket.OPEN) {
                            session.ws.send(JSON.stringify({
                                type: 'output',
                                data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}${exitCode.signal ? ` (${exitCode.signal})` : ''}\x1b[0m\r\n`
                            }));
                        }
                        if (session && session.timeoutId) {
                            clearTimeout(session.timeoutId);
                        }
                        ptySessionsMap.delete(ptySessionKey);
                        shellProcess = null;
                    });

                } catch (spawnError) {
                    console.error('[ERROR] Error spawning process:', spawnError);
                    ws.send(JSON.stringify({
                        type: 'output',
                        data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
                    }));
                }

            } else if (data.type === 'input') {
                // Send input to shell process
                if (shellProcess && shellProcess.write) {
                    try {
                        shellProcess.write(data.data);
                    } catch (error) {
                        console.error('Error writing to shell:', error);
                    }
                } else {
                    console.warn('No active shell process to send input to');
                }
            } else if (data.type === 'resize') {
                // Handle terminal resize
                if (shellProcess && shellProcess.resize) {
                    console.log('Terminal resize requested:', data.cols, 'x', data.rows);
                    shellProcess.resize(data.cols, data.rows);
                }
            }
        } catch (error) {
            console.error('[ERROR] Shell WebSocket error:', error.message);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
                }));
            }
        }
    });

    ws.on('close', () => {
        console.log('🔌 Shell client disconnected');

        if (ptySessionKey) {
            const session = ptySessionsMap.get(ptySessionKey);
            if (session) {
                console.log('⏳ PTY session kept alive, will timeout in 30 minutes:', ptySessionKey);
                session.ws = null;

                session.timeoutId = setTimeout(() => {
                    console.log('⏰ PTY session timeout, killing process:', ptySessionKey);
                    if (session.pty && session.pty.kill) {
                        session.pty.kill();
                    }
                    ptySessionsMap.delete(ptySessionKey);
                }, PTY_SESSION_TIMEOUT);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('[ERROR] Shell WebSocket error:', error);
    });
}

const CHAT_ATTACHMENT_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
]);

function sanitizeAttachmentFilename(name, fallback = 'attachment') {
    const baseName = path.basename(String(name || fallback));
    const sanitized = baseName
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/^\.+$/, fallback)
        .slice(0, 180)
        .trim();
    return sanitized || fallback;
}

function normalizeUploadedFilename(name, fallback = 'attachment') {
    const original = String(name || fallback);
    try {
        const decoded = Buffer.from(original, 'latin1').toString('utf8');
        const looksMojibake = /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùûüýþÿ]/.test(original);
        if (looksMojibake && decoded && !decoded.includes('�')) {
            return decoded;
        }
    } catch {
        // Keep the browser-provided name when transcoding is not applicable.
    }
    return original;
}

async function moveUploadedAttachment(file, attachmentDir, index) {
    const originalName = normalizeUploadedFilename(file.originalname, `attachment-${index + 1}`);
    file.originalname = originalName;
    const safeName = sanitizeAttachmentFilename(originalName, `attachment-${index + 1}`);
    const ext = path.extname(safeName);
    const stem = ext ? safeName.slice(0, -ext.length) : safeName;
    let candidate = `${index + 1}-${safeName}`;
    let destination = path.join(attachmentDir, candidate);
    let suffix = 1;
    while (true) {
        try {
            await fsPromises.access(destination);
            candidate = `${index + 1}-${stem}-${suffix}${ext}`;
            destination = path.join(attachmentDir, candidate);
            suffix += 1;
        } catch {
            break;
        }
    }

    await fsPromises.copyFile(file.path, destination);
    await fsPromises.unlink(file.path);
    return {
        name: originalName,
        path: destination,
        size: file.size,
        mimeType: file.mimetype || mime.lookup(originalName) || 'application/octet-stream',
        sha256: await hashUploadedFileSha256(destination),
    };
}

async function hashUploadedFileSha256(filePath) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(filePath)) {
        hash.update(chunk);
    }
    return `sha256:${hash.digest('hex')}`;
}

// Mixed chat attachment upload endpoint. Images are returned as data URLs for
// multimodal input and previews; other files are staged under the project so
// the gateway can resolve them by path.
app.post('/api/projects/:projectName/upload-attachments', authenticateToken, async (req, res) => {
    let multerUpload;
    try {
        const multer = (await import('multer')).default;
        const uploadRoot = path.join(os.tmpdir(), 'pilotdeck-chat-attachments', String(req.user.id));
        const storage = multer.diskStorage({
            destination: async (_req, _file, cb) => {
                try {
                    await fsPromises.mkdir(uploadRoot, { recursive: true });
                    cb(null, uploadRoot);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (_req, file, cb) => {
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                file.originalname = normalizeUploadedFilename(file.originalname);
                cb(null, `${uniqueSuffix}-${sanitizeAttachmentFilename(file.originalname)}`);
            },
        });

        multerUpload = multer({
            storage,
            limits: {
                fileSize: 20 * 1024 * 1024,
                files: 10,
            },
        }).array('attachments', 10);
    } catch (error) {
        console.error('Error configuring attachment upload:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

    multerUpload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No attachments provided' });
        }

        let attachmentDir = null;
        try {
            const projectRoot = await extractProjectDirectory(req.params.projectName);
            const targetDir = path.join(projectRoot, '.tmp', 'chat-attachments', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
            const validation = validatePathInProject(projectRoot, targetDir);
            if (!validation.valid) {
                throw new Error(validation.error || 'Invalid attachment target');
            }
            attachmentDir = validation.resolved;

            const images = [];
            const files = [];
            await fsPromises.mkdir(attachmentDir, { recursive: true });

            for (const [index, file] of req.files.entries()) {
                if (CHAT_ATTACHMENT_IMAGE_MIMES.has(file.mimetype)) {
                    const originalName = normalizeUploadedFilename(file.originalname);
                    const buffer = await fsPromises.readFile(file.path);
                    await fsPromises.unlink(file.path).catch(() => { });
                    images.push({
                        name: originalName,
                        data: `data:${file.mimetype};base64,${buffer.toString('base64')}`,
                        size: file.size,
                        mimeType: file.mimetype,
                        sha256: `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`,
                    });
                    continue;
                }

                files.push(await moveUploadedAttachment(file, attachmentDir, index));
            }

            if (files.length === 0 && attachmentDir) {
                await fsPromises.rm(attachmentDir, { recursive: true, force: true }).catch(() => { });
            }

            res.json({ images, files });
        } catch (error) {
            console.error('Error processing attachments:', error);
            await Promise.all((req.files || []).map(file => fsPromises.unlink(file.path).catch(() => { })));
            if (attachmentDir) {
                await fsPromises.rm(attachmentDir, { recursive: true, force: true }).catch(() => { });
            }
            res.status(500).json({ error: 'Failed to process attachments' });
        }
    });
});

// Image upload endpoint
app.post('/api/projects/:projectName/upload-images', authenticateToken, async (req, res) => {
    try {
        const multer = (await import('multer')).default;
        const path = (await import('path')).default;
        const fs = (await import('fs')).promises;
        const os = (await import('os')).default;

        // Configure multer for image uploads
        const storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = path.join(os.tmpdir(), 'pilotdeck-image-uploads', String(req.user.id));
                await fs.mkdir(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                cb(null, uniqueSuffix + '-' + sanitizedName);
            }
        });

        const fileFilter = (req, file, cb) => {
            const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
            }
        };

        const upload = multer({
            storage,
            fileFilter,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB
                files: 5
            }
        });

        // Handle multipart form data
        upload.array('images', 5)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No image files provided' });
            }

            try {
                // Process uploaded images
                const processedImages = await Promise.all(
                    req.files.map(async (file) => {
                        // Read file and convert to base64
                        const buffer = await fs.readFile(file.path);
                        const base64 = buffer.toString('base64');
                        const mimeType = file.mimetype;

                        // Clean up temp file immediately
                        await fs.unlink(file.path);

                        return {
                            name: file.originalname,
                            data: `data:${mimeType};base64,${base64}`,
                            size: file.size,
                            mimeType: mimeType
                        };
                    })
                );

                res.json({ images: processedImages });
            } catch (error) {
                console.error('Error processing images:', error);
                // Clean up any remaining files
                await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => { })));
                res.status(500).json({ error: 'Failed to process images' });
            }
        });
    } catch (error) {
        console.error('Error in image upload endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get token usage for a specific session
app.get('/api/projects/:projectName/sessions/:sessionId/token-usage', authenticateToken, async (req, res) => {
    try {
        const { projectName, sessionId } = req.params;
        const { provider = 'pilotdeck' } = req.query;
        const homeDir = os.homedir();

        // PilotDeck sessions use `web:s_<uuid>` keys; Windows-safe sessions
        // may use `web-s_<uuid>` because ':' is illegal in Windows filenames.
        if (provider === 'pilotdeck' || /^web[:_-]s_/.test(sessionId)) {
            return res.json(getSessionTokenBudget(sessionId));
        }

        // Allow only safe characters in sessionId
        const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '');
        if (!safeSessionId || safeSessionId !== String(sessionId)) {
            return res.status(400).json({ error: 'Invalid sessionId' });
        }

        // Handle Cursor sessions - they use SQLite and don't have token usage info
        if (provider === 'cursor') {
            return res.json({
                used: 0,
                total: 0,
                breakdown: { input: 0, cacheCreation: 0, cacheRead: 0 },
                unsupported: true,
                message: 'Token usage tracking not available for Cursor sessions'
            });
        }

        // Handle Gemini sessions - they are raw logs in our current setup
        if (provider === 'gemini') {
            return res.json({
                used: 0,
                total: 0,
                breakdown: { input: 0, cacheCreation: 0, cacheRead: 0 },
                unsupported: true,
                message: 'Token usage tracking not available for Gemini sessions'
            });
        }

        // Handle Codex sessions
        if (provider === 'codex') {
            const codexSessionsDir = path.join(homeDir, '.codex', 'sessions');

            // Find the session file by searching for the session ID
            const findSessionFile = async (dir) => {
                try {
                    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            const found = await findSessionFile(fullPath);
                            if (found) return found;
                        } else if (entry.name.includes(safeSessionId) && entry.name.endsWith('.jsonl')) {
                            return fullPath;
                        }
                    }
                } catch (error) {
                    // Skip directories we can't read
                }
                return null;
            };

            const sessionFilePath = await findSessionFile(codexSessionsDir);

            if (!sessionFilePath) {
                return res.status(404).json({ error: 'Codex session file not found', sessionId: safeSessionId });
            }

            // Read and parse the Codex JSONL file
            let fileContent;
            try {
                fileContent = await fsPromises.readFile(sessionFilePath, 'utf8');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return res.status(404).json({ error: 'Session file not found', path: sessionFilePath });
                }
                throw error;
            }
            const lines = fileContent.trim().split('\n');
            let totalTokens = 0;
            let contextWindow = 200000; // Default for Codex/OpenAI

            // Find the latest token_count event with info (scan from end)
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const entry = JSON.parse(lines[i]);

                    // Codex stores token info in event_msg with type: "token_count"
                    if (entry.type === 'event_msg' && entry.payload?.type === 'token_count' && entry.payload?.info) {
                        const tokenInfo = entry.payload.info;
                        if (tokenInfo.total_token_usage) {
                            totalTokens = tokenInfo.total_token_usage.total_tokens || 0;
                        }
                        if (tokenInfo.model_context_window) {
                            contextWindow = tokenInfo.model_context_window;
                        }
                        break; // Stop after finding the latest token count
                    }
                } catch (parseError) {
                    // Skip lines that can't be parsed
                    continue;
                }
            }

            return res.json({
                used: totalTokens,
                total: contextWindow
            });
        }

        // Extract actual project path
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            console.error('Error extracting project directory:', error);
            return res.status(500).json({ error: 'Failed to determine project path' });
        }


        const encodedPath = projectPath.replace(/[^a-zA-Z0-9-]/g, '-');
        const projectDir = path.join(homeDir, '.pilotdeck', 'projects', encodedPath);

        const jsonlPath = path.join(projectDir, `${safeSessionId}.jsonl`);

        // Constrain to projectDir
        const rel = path.relative(path.resolve(projectDir), path.resolve(jsonlPath));
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            return res.status(400).json({ error: 'Invalid path' });
        }

        // Read and parse the JSONL file
        let fileContent;
        try {
            fileContent = await fsPromises.readFile(jsonlPath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Session file not found', path: jsonlPath });
            }
            throw error; // Re-throw other errors to be caught by outer try-catch
        }
        const lines = fileContent.trim().split('\n');

        const parsedContextWindow = parseInt(process.env.CONTEXT_WINDOW, 10);
        const contextWindow = Number.isFinite(parsedContextWindow) ? parsedContextWindow : 160000;
        let inputTokens = 0;
        let cacheCreationTokens = 0;
        let cacheReadTokens = 0;

        // Find the latest assistant message with usage data (scan from end)
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const entry = JSON.parse(lines[i]);

                // Only count assistant messages which have usage data
                if (entry.type === 'assistant' && entry.message?.usage) {
                    const usage = entry.message.usage;

                    // Use token counts from latest assistant message only
                    inputTokens = usage.input_tokens || 0;
                    cacheCreationTokens = usage.cache_creation_input_tokens || 0;
                    cacheReadTokens = usage.cache_read_input_tokens || 0;

                    break; // Stop after finding the latest assistant message
                }
            } catch (parseError) {
                // Skip lines that can't be parsed
                continue;
            }
        }

        // Calculate total context usage (excluding output_tokens, as per ccusage)
        const totalUsed = inputTokens + cacheCreationTokens + cacheReadTokens;

        res.json({
            used: totalUsed,
            total: contextWindow,
            breakdown: {
                input: inputTokens,
                cacheCreation: cacheCreationTokens,
                cacheRead: cacheReadTokens
            }
        });
    } catch (error) {
        console.error('Error reading session token usage:', error);
        res.status(500).json({ error: 'Failed to read session token usage' });
    }
});

// Serve React app for all other routes (excluding static files)
app.get('*', (req, res) => {
    // PD-SAAS-FORK: never fall through to SPA for API / public share routes (prevents white screen)
    if (req.path.startsWith('/api/') || req.path.startsWith('/share/doc/') || req.path.startsWith('/s/')) {
        return res.status(404).type('text/plain').send('Not found');
    }

    // Skip requests for actual static asset extensions only
    const ext = path.extname(req.path);
    if (ext && /^\.(js|css|map|json|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|mp4|webm)$/.test(ext)) {
        return res.status(404).send('Not found');
    }

    // Only serve index.html for HTML routes, not for static assets
    // Static assets should already be handled by express.static middleware above
    const indexPath = path.join(__dirname, '../dist/index.html');
    const preferViteDev =
        process.env.PILOTDECK_UI_DEV === '1' ||
        process.env.PILOTDECK_UI_DEV === 'true';

    // Check if dist/index.html exists (production build available)
    if (fs.existsSync(indexPath) && !preferViteDev) {
        // Set no-cache headers for HTML to prevent service worker issues
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
    } else {
        // In development, redirect to Vite dev server (live HMR) even when dist exists
        const redirectHost = getConnectableHost(req.hostname);
        const targetPath = req.originalUrl || req.url || '/';
        res.redirect(`${req.protocol}://${redirectHost}:${VITE_PORT}${targetPath}`);
    }
});

// Helper function to convert permissions to rwx format
function permToRwx(perm) {
    const r = perm & 4 ? 'r' : '-';
    const w = perm & 2 ? 'w' : '-';
    const x = perm & 1 ? 'x' : '-';
    return r + w + x;
}

function relativizeFileTreeNodes(nodes, projectRoot) {
    // PD-SAAS-FORK: file tree API must return project-relative paths so the editor
    // does not mis-resolve SaaS cloud-storage absolute disk paths.
    const normalizedRoot = path.resolve(projectRoot);
    return nodes.map((item) => {
        const relativePath = path.relative(normalizedRoot, item.path).split(path.sep).join('/');
        const next = {
            ...item,
            path: relativePath,
        };
        if (item.children?.length) {
            next.children = relativizeFileTreeNodes(item.children, projectRoot);
        }
        return next;
    });
}

async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
    // Using fsPromises from import
    const items = [];

    try {
        const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            // Debug: log all entries including hidden files


            // Skip heavy build directories and VCS directories
            if (entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'build' ||
                entry.name === '.git' ||
                entry.name === '.svn' ||
                entry.name === '.hg') continue;

            const itemPath = path.join(dirPath, entry.name);
            const item = {
                name: entry.name,
                path: itemPath,
                type: entry.isDirectory() ? 'directory' : 'file'
            };

            // Get file stats for additional metadata
            try {
                const stats = await fsPromises.stat(itemPath);
                item.size = stats.size;
                item.modified = stats.mtime.toISOString();

                // Convert permissions to rwx format
                const mode = stats.mode;
                const ownerPerm = (mode >> 6) & 7;
                const groupPerm = (mode >> 3) & 7;
                const otherPerm = mode & 7;
                item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
                item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
            } catch (statError) {
                // If stat fails, provide default values
                item.size = 0;
                item.modified = null;
                item.permissions = '000';
                item.permissionsRwx = '---------';
            }

            if (entry.isDirectory() && currentDepth < maxDepth) {
                // Recursively get subdirectories but limit depth
                try {
                    // Check if we can access the directory before trying to read it
                    await fsPromises.access(item.path, fs.constants.R_OK);
                    item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
                } catch (e) {
                    // Silently skip directories we can't access (permission denied, etc.)
                    item.children = [];
                }
            }

            items.push(item);
        }
    } catch (error) {
        // Only log non-permission errors to avoid spam
        if (error.code !== 'EACCES' && error.code !== 'EPERM') {
            console.error('Error reading directory:', error);
        }
    }

    return items.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

const SERVER_PORT = process.env.SERVER_PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const DISPLAY_HOST = getConnectableHost(HOST);
const VITE_PORT = process.env.VITE_PORT || 5173;

async function ensureLocalUserWhenAuthDisabled() {
    // PD-SAAS-FORK: SaaS seeds admin via control DB bootstrap, not a fake local user.
    if (IS_SAAS_MODE || !DISABLE_LOCAL_AUTH || userDb.hasUsers()) {
        return;
    }
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    userDb.createUser('local', passwordHash);
    console.log(`${c.info('[INFO]')} Web UI login is disabled (default). Using built-in user. Set PILOTDECK_DISABLE_LOCAL_AUTH=0 to require username/password.`);
}

// Initialize database and start server
async function startServer() {
    try {
        await startServerAfterStartup({
            startupFn: async () => {
                await runServerStartupBeforeListen({
                    initializeDatabaseFn: initializeDatabase,
                    ensureLocalUserWhenAuthDisabledFn: ensureLocalUserWhenAuthDisabled,
                    configureWebPushFn: configureWebPush
                });
                await initializeSaasBackend({
                    log: (line) => console.log(`${c.info('[INFO]')} ${line}`),
                });
            },
            listenFn: async () => {
                // Check if running in production mode (dist folder exists)
                const distIndexPath = path.join(__dirname, '../dist/index.html');
                const isProduction = fs.existsSync(distIndexPath);

                console.log(`${c.info('[INFO]')} Chat execution routed through NovaStudio gateway (src/gateway).`);
                console.log('');

                if (isProduction) {
                    console.log(`${c.info('[INFO]')} Starting in production mode...`);
                } else {
                    console.log(`${c.info('[INFO]')} No production frontend build found; development mode expects Vite at http://${DISPLAY_HOST}:${VITE_PORT}`);
                }

                const boundPort = await listenWithPortFallback(server, Number(SERVER_PORT), HOST, {
                    log: (line) => console.log(`${c.warn('[WARN]')} ${line}`),
                });
                if (boundPort === null) {
                    console.error(`${c.warn('[ERROR]')} Could not bind a port after ${PORT_FALLBACK_ATTEMPTS} attempts (preferred ${SERVER_PORT}). All tried ports were in use. Set SERVER_PORT to a free port and retry.`);
                    process.exit(1);
                }
                // Sync the actually-bound port back to the env so other modules
                // that self-reference SERVER_PORT (e.g. routes/taskmaster.js) hit
                // the right port after a fallback.
                process.env.SERVER_PORT = String(boundPort);
                {
                    const appInstallPath = path.join(__dirname, '..');

                    console.log('');
                    console.log(c.dim('═'.repeat(63)));
                    console.log(`  ${c.bright('Nova Ai-Studio Server - Ready')}`);
                    console.log(c.dim('═'.repeat(63)));
                    console.log('');
                    console.log(`${c.info('[INFO]')} Server URL:  ${c.bright('http://' + DISPLAY_HOST + ':' + boundPort)}`);
                    console.log(`${c.info('[INFO]')} Installed at: ${c.dim(appInstallPath)}`);
                    console.log(`${c.tip('[TIP]')}  Run "pilotdeck status" for full configuration details`);
                    console.log('');

                    // Desktop shell loads the UI inside Electron; CLI/dev can opt in to
                    // auto-open. PILOTDECK_DESKTOP=1 is set by apps/desktop server-manager.
                    const skipAutoOpen =
                        process.env.PILOTDECK_DESKTOP === '1'
                        || process.env.PILOTDECK_SKIP_BROWSER_OPEN === '1';
                    if (!skipAutoOpen) {
                        const serverUrl = `http://${DISPLAY_HOST === '0.0.0.0' ? 'localhost' : DISPLAY_HOST}:${boundPort}`;
                        const openCmd = process.platform === 'darwin' ? 'open'
                                      : process.platform === 'win32' ? 'start'
                                      : 'xdg-open';
                        exec(`${openCmd} "${serverUrl}"`, () => {});
                    }

                    // Start watching the projects folder for changes
                    await setupProjectsWatcher();

                    // PD-SAAS-FORK (Train-0D): resume queued turns after Bridge restart.
                    void hydrateAndPumpAllQueuedOnStartup();

                    // Start background memory scheduler for auto index/dream.
                    startMemoryScheduler();

                    // Start server-side plugin processes for enabled plugins
                    startEnabledPluginServers().catch(err => {
                        console.error('[Plugins] Error during startup:', err.message);
                    });

                    // Hot-reload watcher: external edits to ~/.pilotdeck/pilotdeck.yaml
                    // (vim, Cursor, another process) trigger a validate+reload and push
                    // a "config:reloaded" event to every connected WebSocket client.
                    await startPilotDeckConfigWatcher({
                        onEvent: (payload) => {
                            process.emit('pilotdeck:config-broadcast', payload);
                        },
                    });
                }
            }
        });

        let shutdownPromise = null;
        const gracefulShutdown = async () => {
            if (shutdownPromise) {
                return shutdownPromise;
            }

            shutdownPromise = (async () => {
                try {
                    stopMemoryScheduler();
                    closeMemoryServices();
                    stopPilotDeckConfigWatcher();
                    await stopAllPlugins();
                    try {
                        const { flushCatalogWritesOnShutdown } = await import('./saas/conversation/catalogBridgeHooks.js');
                        await flushCatalogWritesOnShutdown();
                    } catch (catalogFlushError) {
                        console.warn('[shutdown] catalog flush skipped:', catalogFlushError?.message || catalogFlushError);
                    }
                    // helpers were retired with the four-provider runtime.
                    try {
                        const { shutdownGlobalChrome, stopChromeHealthCheck } = await import('./utils/globalChrome.js');
                        stopChromeHealthCheck();
                        shutdownGlobalChrome();
                    } catch { /* Chrome may not have been started */ }
                    // PilotDeck cron is owned by `pilotdeck server` and shuts
                    // down with it; ui/server never spawns its own daemon.
                } finally {
                    process.exit(0);
                }
            })();

            return shutdownPromise;
        };
        process.on('SIGTERM', () => void gracefulShutdown());
        process.on('SIGINT', () => void gracefulShutdown());
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
