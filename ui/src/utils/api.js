import { DISABLE_LOCAL_AUTH, IS_PLATFORM } from "../constants/config";
import { normalizeArtifactPath } from "../shared/artifactPaths";
import { createManagedFetchSignal } from "../shared/networkFetchRegistry";

const normalizePathForUrl = (value) => normalizeArtifactPath(value);

const getProjectRelativePath = (filePath, projectRoot) => {
  const normalizedFilePath = normalizeArtifactPath(filePath, projectRoot);
  const normalizedRoot = normalizeArtifactPath(projectRoot || '', projectRoot).replace(/\/+$/, '');

  if (!normalizedRoot) {
    return normalizedFilePath.replace(/^\/+/, '');
  }

  if (normalizedFilePath === normalizedRoot) {
    return '';
  }

  const fileLower = normalizedFilePath.toLowerCase();
  const rootLower = normalizedRoot.toLowerCase();
  if (fileLower === rootLower) {
    return '';
  }
  if (fileLower.startsWith(`${rootLower}/`)) {
    return normalizedFilePath.slice(normalizedRoot.length + 1);
  }

  return normalizedFilePath.replace(/^\/+/, '');
};

const encodePathSegments = (relativePath) =>
  String(relativePath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const appendAuthToken = (url) => {
  const token = localStorage.getItem('auth-token');
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};

// Utility function for authenticated API calls
export const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('auth-token');

  const defaultHeaders = {};

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (!IS_PLATFORM && token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const { noTimeout, timeoutMs, ...fetchOptions } = options;
  const { signal, cleanup } = createManagedFetchSignal({
    ...fetchOptions,
    noTimeout,
    timeoutMs,
  });

  return fetch(url, {
    ...fetchOptions,
    signal,
    headers: {
      ...defaultHeaders,
      ...fetchOptions.headers,
    },
  }).then((response) => {
    const refreshedToken = response.headers.get('X-Refreshed-Token');
    if (refreshedToken) {
      localStorage.setItem('auth-token', refreshedToken);
    }
    return response;
  }).finally(cleanup);
};

// API endpoints
export const api = {
  // Auth endpoints (no token required)
  auth: {
    status: () => fetch('/api/auth/status'),
    login: (username, password) => fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    register: (username, password) => fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    user: () => authenticatedFetch('/api/auth/user'),
    logout: () => authenticatedFetch('/api/auth/logout', { method: 'POST' }),
    repairTurnQueue: () => authenticatedFetch('/api/saas/turn-queue/repair', { method: 'POST' }),
  },

  // Protected endpoints
  // config endpoint removed - no longer needed (frontend uses window.location)
  projects: ({ fresh = false } = {}) => {
    const suffix = fresh ? `?fresh=1&_=${Date.now()}` : '';
    return authenticatedFetch(`/api/projects${suffix}`);
  },
  capabilities: ({ projectPath = '', stage = '', role = '', level = '', locale = '', admin = false } = {}) => {
    const params = new URLSearchParams();
    if (projectPath) params.append('projectPath', projectPath);
    if (stage) params.append('stage', stage);
    if (role) params.append('role', role);
    if (level) params.append('level', level);
    if (locale) params.append('locale', locale);
    if (admin) params.append('admin', '1');
    const query = params.toString();
    return authenticatedFetch(`/api/capabilities${query ? `?${query}` : ''}`);
  },
  capabilitiesWelcome: ({ projectPath = '', locale = '' } = {}) => {
    const params = new URLSearchParams();
    if (projectPath) params.append('projectPath', projectPath);
    if (locale) params.append('locale', locale);
    const query = params.toString();
    return authenticatedFetch(`/api/capabilities/welcome${query ? `?${query}` : ''}`);
  },
  alwaysOnDashboardEvents: (limit = 200, since) =>
    authenticatedFetch(`/api/always-on/events?limit=${encodeURIComponent(limit)}${since ? `&since=${encodeURIComponent(since)}` : ''}`),
  allCronJobs: () =>
    authenticatedFetch('/api/always-on/cron-jobs'),
  cronRunNow: (taskId) =>
    authenticatedFetch(`/api/always-on/cron-jobs/${encodeURIComponent(taskId)}/run-now`, { method: 'POST' }),
  cronStop: (taskId) =>
    authenticatedFetch(`/api/always-on/cron-jobs/${encodeURIComponent(taskId)}/stop`, { method: 'POST' }),
  cronDelete: (taskId) =>
    authenticatedFetch(`/api/always-on/cron-jobs/${encodeURIComponent(taskId)}`, { method: 'DELETE' }),
  projectDiscoveryContext: (projectName) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/discovery-context`),
  projectDiscoveryPlans: (projectName) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/discovery-plans`),
  executeProjectDiscoveryPlan: (projectName, planId, body = {}) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/discovery-plans/${encodeURIComponent(planId)}/execute`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  discoveryPlanReport: (projectName, planId) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/discovery-plans/${encodeURIComponent(planId)}/report`),
  projectWorkCycles: (projectName) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/work-cycles`),
  applyWorkCycle: (projectName, cycleId) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/work-cycles/${encodeURIComponent(cycleId)}/apply`, {
      method: 'POST',
    }),
  archiveWorkCycle: (projectName, cycleId) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/work-cycles/${encodeURIComponent(cycleId)}/archive`, {
      method: 'POST',
    }),
  sessions: (projectName, limit = 5, offset = 0, { includeOlder = false } = {}) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (includeOlder) params.set('includeOlder', '1');
    return authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/sessions?${params.toString()}`);
  },
  // Unified endpoint — all providers through one URL
  sessionResumeContext: (sessionId, { projectName = '', projectPath = '' } = {}) => {
    const params = new URLSearchParams();
    if (projectName) params.append('projectName', projectName);
    if (projectPath) params.append('projectPath', projectPath);
    const queryString = params.toString();
    return authenticatedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/resume-context${queryString ? `?${queryString}` : ''}`);
  },
  // PD-SAAS-FORK (P0-2): server-anchored cold-resume claim (idempotent / budgeted / recency-gated)
  sessionColdResume: (sessionId, { projectName = '', projectPath = '' } = {}) => {
    const params = new URLSearchParams();
    if (projectName) params.append('projectName', projectName);
    if (projectPath) params.append('projectPath', projectPath);
    const queryString = params.toString();
    return authenticatedFetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/cold-resume${queryString ? `?${queryString}` : ''}`,
      { method: 'POST' },
    );
  },
  unifiedSessionMessages: (sessionId, provider = 'claude', { projectName = '', projectPath = '', limit = null, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    params.append('provider', provider);
    if (projectName) params.append('projectName', projectName);
    if (projectPath) params.append('projectPath', projectPath);
    if (limit !== null) {
      params.append('limit', String(limit));
      params.append('offset', String(offset));
    }
    const queryString = params.toString();
    return authenticatedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages${queryString ? `?${queryString}` : ''}`);
  },
  renameProject: (projectName, displayName) =>
    authenticatedFetch(`/api/projects/${projectName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  deleteSession: (projectName, sessionId, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.sessionKind) params.append('sessionKind', opts.sessionKind);
    if (opts.parentSessionId) params.append('parentSessionId', opts.parentSessionId);
    if (opts.relativeTranscriptPath) params.append('relativeTranscriptPath', opts.relativeTranscriptPath);
    if (opts.taskId) params.append('taskId', opts.taskId);
    const query = params.toString();
    return authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(sessionId)}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  },
  renameSession: (sessionId, summary, provider) =>
    authenticatedFetch(`/api/sessions/${sessionId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ summary, provider }),
    }),
  deleteProject: (projectName, force = false) =>
    authenticatedFetch(`/api/projects/${projectName}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    }),
  searchConversationsUrl: (query, limit = 50) => {
    const token = localStorage.getItem('auth-token');
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (token) params.set('token', token);
    return `/api/search/conversations?${params.toString()}`;
  },
  createProject: (path) =>
    authenticatedFetch('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  createWorkspace: (workspaceData) =>
    authenticatedFetch('/api/projects/create-workspace', {
      method: 'POST',
      body: JSON.stringify(workspaceData),
    }),
  resolveProjectFile: (projectName, filePath, hintDir) => {
    const params = new URLSearchParams({ filePath });
    if (hintDir) {
      params.set('hintDir', hintDir);
    }
    return authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/file/resolve?${params.toString()}`,
    );
  },
  readFile: (projectName, filePath, hintDir) => {
    const params = new URLSearchParams({ filePath });
    if (hintDir) {
      params.set('hintDir', hintDir);
    }
    return authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/file?${params.toString()}`,
    );
  },
  repairBentoDeck: (projectName, filePath, hintDir) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/file/repair-bento`, {
      method: 'POST',
      body: JSON.stringify({ filePath, hintDir }),
    }),
  readFileBlob: (projectName, filePath, projectRootOrOptions = '') => {
    const options = typeof projectRootOrOptions === 'object' && projectRootOrOptions !== null
      ? projectRootOrOptions
      : { projectRoot: projectRootOrOptions };
    const relativePath = getProjectRelativePath(filePath, options.projectRoot || '');
    const params = new URLSearchParams({ path: relativePath });
    if (options.hintDir) {
      params.set('hintDir', options.hintDir);
    }
    return authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/content?${params.toString()}`,
      { timeoutMs: 60_000 },
    );
  },
  saveFile: (projectName, filePath, content) =>
    authenticatedFetch(`/api/projects/${projectName}/file`, {
      method: 'PUT',
      body: JSON.stringify({ filePath, content }),
    }),
  getFiles: (projectName, options = {}) =>
    authenticatedFetch(`/api/projects/${projectName}/files`, options),

  // Shallow listing of a single folder (used by the deliverable folder browser)
  listProjectFolder: (projectName, dirPath = '') =>
    authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/list?path=${encodeURIComponent(dirPath)}`,
    ),

  // File operations
  createFile: (projectName, { path, type, name }) =>
    authenticatedFetch(`/api/projects/${projectName}/files/create`, {
      method: 'POST',
      body: JSON.stringify({ path, type, name }),
    }),

  renameFile: (projectName, { oldPath, newName }) =>
    authenticatedFetch(`/api/projects/${projectName}/files/rename`, {
      method: 'PUT',
      body: JSON.stringify({ oldPath, newName }),
    }),

  deleteFile: (projectName, { path, type }) =>
    authenticatedFetch(`/api/projects/${projectName}/files`, {
      method: 'DELETE',
      body: JSON.stringify({ path, type }),
    }),

  uploadFiles: (projectName, formData) =>
    authenticatedFetch(`/api/projects/${projectName}/files/upload`, {
      method: 'POST',
      body: formData,
      headers: {},
    }),

  projectPreviewUrl: (projectName, filePath, projectRoot) => {
    const relativePath = getProjectRelativePath(filePath, projectRoot);
    const encoded = encodePathSegments(relativePath);
    return appendAuthToken(
      `/api/projects/${encodeURIComponent(projectName)}/preview/${encoded}`,
    );
  },

  /** PD-SAAS-FORK: Markdown 公开分享 — 创建公开链接（无 JWT） */
  createMarkdownShare: (projectName, filePath, projectRoot = '', hintDir, seoIndexable = false) => {
    const relativePath = getProjectRelativePath(filePath, projectRoot);
    return authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/share/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: relativePath,
        hintDir: hintDir || undefined,
        seoIndexable: Boolean(seoIndexable),
      }),
    });
  },

  revokeMarkdownShare: (projectName, shareId) =>
    authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/share/markdown/${encodeURIComponent(shareId)}`,
      { method: 'DELETE' },
    ),

  markdownShareStatus: (projectName, filePath, projectRoot = '') => {
    const relativePath = getProjectRelativePath(filePath, projectRoot);
    const qs = new URLSearchParams({ path: relativePath });
    return authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/share/markdown/status?${qs}`,
    );
  },

  revealProjectPath: (projectName, filePath, mode = 'folder') =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ path: filePath, mode }),
    }),

  downloadProjectZip: (projectName) =>
    authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/download`),

  fileDownloadUrl: (projectName, filePath, projectRoot = '') => {
    const relativePath = getProjectRelativePath(filePath, projectRoot);
    return appendAuthToken(
      `/api/projects/${encodeURIComponent(projectName)}/files/content?path=${encodeURIComponent(relativePath)}&download=1`,
    );
  },

  /** Inline file content URL (no forced download) for PDF/video/embed previews. */
  fileContentUrl: (projectName, filePath, projectRoot = '', hintDir) => {
    const relativePath = getProjectRelativePath(filePath, projectRoot);
    const params = new URLSearchParams({ path: relativePath });
    if (hintDir) {
      params.set('hintDir', hintDir);
    }
    return appendAuthToken(
      `/api/projects/${encodeURIComponent(projectName)}/files/content?${params.toString()}`,
    );
  },

  thumbnailUrl: (projectName, filePath, options = {}) => {
    const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 320;
    const q = Number.isFinite(Number(options.q)) ? Number(options.q) : 75;
    const format = options.format || 'webp';
    const relativePath = getProjectRelativePath(filePath, options.projectRoot || '');
    const params = new URLSearchParams({
      path: relativePath,
      max: String(max),
      q: String(q),
      format,
    });
    if (options.hintDir) {
      params.set('hintDir', options.hintDir);
    }
    return appendAuthToken(
      `/api/projects/${encodeURIComponent(projectName)}/files/thumbnail?${params.toString()}`,
    );
  },

  // PD-SAAS-FORK: UI document export (capabilities + async jobs)
  getExportCapabilities: async (projectName, filePath) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/export/capabilities?path=${encodeURIComponent(filePath)}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `export_capabilities_${res.status}`);
    }
    return res.json();
  },
  startExportJob: async (projectName, body) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/export`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `export_start_${res.status}`);
    }
    return res.json();
  },
  // PD-SAAS-FORK: Markdown 浏览器 — 正文直传服务端落盘导出（绕过 SaaS saveFile 403）
  startExportFromContent: async (projectName, body) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/export-content`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `export_content_${res.status}`);
    }
    return res.json();
  },
  pollExportJob: async (projectName, jobId) => {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/files/export/${encodeURIComponent(jobId)}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `export_poll_${res.status}`);
    }
    return res.json();
  },

  // PD-SAAS-FORK: bundled skill reference files (diagram-maker:references:…)
  readSkillAsset: (slug, relativePath, projectPath) =>
    authenticatedFetch('/api/skills/read-asset', {
      method: 'POST',
      body: JSON.stringify({ slug, relativePath, projectPath }),
    }),

  // TaskMaster endpoints
  taskmaster: {
    // Initialize TaskMaster in a project
    init: (projectName) =>
      authenticatedFetch(`/api/taskmaster/init/${projectName}`, {
        method: 'POST',
      }),

    // Add a new task
    addTask: (projectName, { prompt, title, description, priority, dependencies }) =>
      authenticatedFetch(`/api/taskmaster/add-task/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ prompt, title, description, priority, dependencies }),
      }),

    // Parse PRD to generate tasks
    parsePRD: (projectName, { fileName, numTasks, append }) =>
      authenticatedFetch(`/api/taskmaster/parse-prd/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ fileName, numTasks, append }),
      }),

    // Get available PRD templates
    getTemplates: () =>
      authenticatedFetch('/api/taskmaster/prd-templates'),

    // Apply a PRD template
    applyTemplate: (projectName, { templateId, fileName, customizations }) =>
      authenticatedFetch(`/api/taskmaster/apply-template/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ templateId, fileName, customizations }),
      }),

    // Update a task
    updateTask: (projectName, taskId, updates) =>
      authenticatedFetch(`/api/taskmaster/update-task/${projectName}/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
  },

  // Browse filesystem for project suggestions
  browseFilesystem: (dirPath = null) => {
    const params = new URLSearchParams();
    if (dirPath) params.append('path', dirPath);

    return authenticatedFetch(`/api/browse-filesystem?${params}`);
  },

  createFolder: (folderPath) =>
    authenticatedFetch('/api/create-folder', {
      method: 'POST',
      body: JSON.stringify({ path: folderPath }),
    }),

  // User endpoints
  user: {
    gitConfig: () => authenticatedFetch('/api/user/git-config'),
    updateGitConfig: (gitName, gitEmail) =>
      authenticatedFetch('/api/user/git-config', {
        method: 'POST',
        body: JSON.stringify({ gitName, gitEmail }),
      }),
    onboardingStatus: () => authenticatedFetch('/api/user/onboarding-status'),
    completeOnboarding: () =>
      authenticatedFetch('/api/user/complete-onboarding', {
        method: 'POST',
      }),
  },

  // Generic GET method for any endpoint
  get: (endpoint) => authenticatedFetch(`/api${endpoint}`),

  // Generic POST method for any endpoint
  post: (endpoint, body) => authenticatedFetch(`/api${endpoint}`, {
    method: 'POST',
    ...(body instanceof FormData ? { body } : { body: JSON.stringify(body) }),
  }),

  // Generic PUT method for any endpoint
  put: (endpoint, body) => authenticatedFetch(`/api${endpoint}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),

  // Generic DELETE method for any endpoint
  delete: (endpoint, options = {}) => authenticatedFetch(`/api${endpoint}`, {
    method: 'DELETE',
    ...options,
  }),
};
