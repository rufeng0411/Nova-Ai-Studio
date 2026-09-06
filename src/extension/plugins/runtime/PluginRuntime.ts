import { dirname, join, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { resolvePluginDirectories } from "../discovery/PluginDirectoryResolver.js";
import { discoverPluginPaths, discoverSkillPaths } from "../discovery/discoverLocalPlugins.js";
import { loadPluginFromPath, loadSkillFromPath } from "../loading/PluginLoader.js";
import { loadPluginHooks } from "../loading/PluginHookLoader.js";
import type { LoadedPluginCommand } from "../loading/PluginCommandLoader.js";
import type { PilotDeckLoadedPlugin } from "../protocol/plugin.js";
import { PluginRegistry } from "./PluginRegistry.js";
import { truncateMcpInstructionString } from "./truncateMcpString.js";
import type { PilotDeckHooksSettings } from "../../hooks/protocol/settings.js";
import type { PilotDeckCustomRouter } from "../../../router/customRouter/customRouter.js";

/**
 * Static MCP server contribution shape callers can rely on. Manifests load
 * `mcpServers` as `Record<string, unknown>` to stay forward-compatible, so
 * this type is *advisory* — the runtime only reads `instructions` and falls
 * back gracefully when missing.
 */
export type PilotDeckMcpServerStaticSpec = {
  instructions?: string;
  [key: string]: unknown;
};

/**
 * Aggregated B3 instruction entry (always non-empty `instructions`). Exposed
 * as a stricter alias of {@link PluginMcpInstruction} so callers that only
 * care about *populated* entries keep a non-optional `instructions` field.
 */
export type PilotDeckMcpInstructionEntry = {
  serverName: string;
  instructions: string;
};

export type PluginRuntimeOptions = {
  projectRoot: string;
  pilotHome: string;
  builtinPlugins?: PilotDeckLoadedPlugin[];
  builtinPluginsEnabled?: Record<string, boolean>;
};

export type PluginRefreshResult = {
  previous: PilotDeckLoadedPlugin[];
  next: PilotDeckLoadedPlugin[];
  added: PilotDeckLoadedPlugin[];
  removed: PilotDeckLoadedPlugin[];
};

export type PluginCommandContribution = {
  name: string;
  description?: string;
  argumentHint?: string;
  namespace?: string;
};

export type PluginSkillContribution = {
  name: string;
  description?: string;
  namespace?: string;
};

export type PluginMcpInstruction = {
  serverName: string;
  instructions?: string;
};

export type PluginContributionSnapshot = {
  plugins: PilotDeckLoadedPlugin[];
  commands: PluginCommandContribution[];
  skills: PluginSkillContribution[];
  outputStyles: LoadedPluginCommand[];
  hooks: PilotDeckHooksSettings;
  mcpServers: Record<string, unknown>;
  lspServers: Record<string, unknown>;
  mcpInstructions: PluginMcpInstruction[];
};

export class PluginRuntime {
  private readonly registry = new PluginRegistry();
  private lastDiscoveryFingerprint?: string;

  constructor(private readonly options: PluginRuntimeOptions) {}

  snapshot(): PilotDeckLoadedPlugin[] {
    return this.registry.list();
  }

  mcpServers(): Record<string, unknown> {
    return Object.assign({}, ...this.registry.list().map((plugin) => plugin.mcpServers ?? {})) as Record<string, unknown>;
  }

  /**
   * Read-only static instructions aggregator (deferred-feature §5.3 / B3).
   * - Iterates `mcpServers` from every loaded plugin.
   * - Filters entries with a non-empty `instructions: string` field.
   * - Truncates each entry to {@link truncateMcpInstructionString} (2048 chars).
   * - Returns a stable list sorted by `serverName` (avoids prompt-cache thrash).
   *
   * Once C1 (real MCP runtime) lands, the runtime can layer dynamic
   * instructions on top via the same `getAllMcpInstructions` aggregator
   * surface used by `PluginRuntimeExtensionResolver`.
   */
  getAllMcpInstructions(): PilotDeckMcpInstructionEntry[] {
    const entries: PilotDeckMcpInstructionEntry[] = [];
    const seen = new Set<string>();
    for (const plugin of this.registry.list()) {
      const servers = plugin.mcpServers;
      if (!servers || typeof servers !== "object") continue;
      for (const [serverName, raw] of Object.entries(servers)) {
        if (seen.has(serverName)) continue;
        if (!raw || typeof raw !== "object") continue;
        const candidate = (raw as PilotDeckMcpServerStaticSpec).instructions;
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (trimmed.length === 0) continue;
        seen.add(serverName);
        entries.push({
          serverName,
          instructions: truncateMcpInstructionString(trimmed),
        });
      }
    }
    entries.sort((a, b) => a.serverName.localeCompare(b.serverName));
    return entries;
  }

  lspServers(): Record<string, unknown> {
    return Object.assign({}, ...this.registry.list().map((plugin) => plugin.lspServers ?? {})) as Record<string, unknown>;
  }

  snapshotContributions(): PluginContributionSnapshot {
    const plugins = this.registry.list();
    return {
      plugins,
      commands: plugins.flatMap((plugin) => (plugin.commands ?? []).map((command) => toCommandContribution(plugin, command))),
      skills: plugins.flatMap((plugin) => (plugin.skills ?? []).map((skill) => toSkillContribution(plugin, skill))),
      outputStyles: plugins.flatMap((plugin) => plugin.outputStyles ?? []),
      hooks: loadPluginHooks(plugins),
      mcpServers: this.mcpServers(),
      lspServers: this.lspServers(),
      mcpInstructions: this.getAllMcpInstructions(),
    };
  }

  getAllCommands(): PluginCommandContribution[] {
    return this.snapshotContributions().commands;
  }

  getAllSkills(): PluginSkillContribution[] {
    return this.snapshotContributions().skills;
  }

  lookupRouter(extensionId: string): PilotDeckCustomRouter | undefined {
    for (const plugin of this.registry.list()) {
      for (const contribution of plugin.routerContributions ?? []) {
        if (contribution.id !== extensionId) {
          continue;
        }
        return contribution.createCustomRouter();
      }
    }
    return undefined;
  }

  async loadSkillPrompt(extensionId: string): Promise<string | undefined> {
    for (const plugin of this.registry.list()) {
      const prompt = plugin.promptContributions?.find((contribution) => contribution.name === extensionId);
      if (prompt) {
        return prompt.content;
      }
      const skill = plugin.skills?.find((entry) => entry.name === extensionId || entry.name.endsWith(`:${extensionId}`));
      if (skill) {
        return skill.content;
      }
      const command = plugin.commands?.find((entry) => entry.name === extensionId || entry.name.endsWith(`:${extensionId}`));
      if (command) {
        return command.content;
      }
    }
    return undefined;
  }

  /** PD-SAAS-FORK: read references/assets under a skill dir (tenant cwd cannot read_file skills/). */
  resolveSkillDirectory(skillName: string): string | undefined {
    const normalized = skillName.trim();
    if (!normalized) return undefined;
    for (const plugin of this.registry.list()) {
      if (plugin.name === normalized && plugin.path) {
        return plugin.path;
      }
      const skill = plugin.skills?.find(
        (entry) => entry.name === normalized || entry.name.endsWith(`:${normalized}`),
      );
      if (skill?.path) {
        return dirname(skill.path);
      }
    }
    return undefined;
  }

  async loadSkillFile(skillName: string, relativePath: string): Promise<string | undefined> {
    const root = this.resolveSkillDirectory(skillName);
    if (!root) return undefined;
    const safe = String(relativePath || "").replace(/^[/\\]+/u, "").replace(/\.\./gu, "");
    if (!safe) return undefined;
    const fullPath = resolve(join(root, safe));
    const rootResolved = resolve(root);
    if (fullPath !== rootResolved && !fullPath.startsWith(`${rootResolved}/`) && !fullPath.startsWith(`${rootResolved}\\`)) {
      return undefined;
    }
    try {
      return await readFile(fullPath, "utf8");
    } catch {
      return undefined;
    }
  }

  async refresh(): Promise<PilotDeckLoadedPlugin[]> {
    return (await this.refreshWithReport()).next;
  }

  /** PD-SAAS-FORK: skip full discovery when plugin/skill directory mtimes are unchanged. */
  async refreshIfNeeded(): Promise<PilotDeckLoadedPlugin[]> {
    const fingerprint = await this.computeDiscoveryFingerprint();
    if (this.lastDiscoveryFingerprint === fingerprint && this.registry.list().length > 0) {
      return this.registry.list();
    }
    const plugins = await this.refresh();
    this.lastDiscoveryFingerprint = fingerprint;
    return plugins;
  }

  invalidateDiscoveryCache(): void {
    this.lastDiscoveryFingerprint = undefined;
  }

  private async computeDiscoveryFingerprint(): Promise<string> {
    const paths = resolvePluginDirectories({
      projectRoot: this.options.projectRoot,
      pilotHome: this.options.pilotHome,
    });
    const dirs = [
      paths.globalPluginsDir,
      paths.projectPluginsDir,
      paths.globalSkillsDir,
      paths.projectSkillsDir,
    ];
    const parts = await Promise.all(
      dirs.map(async (dir) => {
        try {
          const info = await stat(dir);
          return `${dir}:${info.mtimeMs}`;
        } catch {
          return `${dir}:missing`;
        }
      }),
    );
    return parts.join("|");
  }

  async refreshWithReport(): Promise<PluginRefreshResult> {
    const previous = this.registry.list();
    const paths = resolvePluginDirectories({
      projectRoot: this.options.projectRoot,
      pilotHome: this.options.pilotHome,
    });
    const [discovered, discoveredSkills] = await Promise.all([
      discoverPluginPaths([
        { path: paths.globalPluginsDir, source: "global" },
        { path: paths.projectPluginsDir, source: "project" },
      ]),
      discoverSkillPaths([
        { path: paths.globalSkillsDir, source: "global" },
        { path: paths.projectSkillsDir, source: "project" },
      ]),
    ]);
    const [loaded, loadedSkills] = await Promise.all([
      Promise.all(
        discovered.map((plugin) => loadPluginFromPath(plugin.path, plugin.source).catch(() => undefined)),
      ),
      Promise.all(
        discoveredSkills.map((s) => loadSkillFromPath(s.path, s.source).catch(() => undefined)),
      ),
    ]);
    const plugins = [
      ...enabledBuiltinPlugins(this.options.builtinPlugins ?? [], this.options.builtinPluginsEnabled ?? {}),
      ...loaded.filter(isLoadedPlugin),
      ...loadedSkills.filter(isLoadedPlugin),
    ];
    this.registry.replaceAll(plugins);
    this.lastDiscoveryFingerprint = await this.computeDiscoveryFingerprint();
    return {
      previous,
      next: plugins,
      added: plugins.filter((plugin) => !hasPlugin(previous, plugin)),
      removed: previous.filter((plugin) => !hasPlugin(plugins, plugin)),
    };
  }
}

function isLoadedPlugin(value: PilotDeckLoadedPlugin | undefined): value is PilotDeckLoadedPlugin {
  return value !== undefined;
}

function enabledBuiltinPlugins(
  plugins: PilotDeckLoadedPlugin[],
  enabled: Record<string, boolean>,
): PilotDeckLoadedPlugin[] {
  return plugins.filter((plugin) => plugin.source !== "builtin" || enabled[plugin.name] !== false);
}

function hasPlugin(plugins: PilotDeckLoadedPlugin[], plugin: PilotDeckLoadedPlugin): boolean {
  return plugins.some((candidate) => candidate.name === plugin.name && candidate.source === plugin.source);
}

function toCommandContribution(
  plugin: PilotDeckLoadedPlugin,
  command: LoadedPluginCommand,
): PluginCommandContribution {
  return {
    name: command.name,
    description: typeof command.frontmatter.description === "string" ? command.frontmatter.description : undefined,
    argumentHint:
      typeof command.frontmatter["argument-hint"] === "string"
        ? command.frontmatter["argument-hint"]
        : undefined,
    namespace: plugin.name,
  };
}

function toSkillContribution(
  plugin: PilotDeckLoadedPlugin,
  skill: LoadedPluginCommand,
): PluginSkillContribution {
  return {
    name: skill.name,
    description: typeof skill.frontmatter.description === "string" ? skill.frontmatter.description : undefined,
    namespace: plugin.name,
  };
}

