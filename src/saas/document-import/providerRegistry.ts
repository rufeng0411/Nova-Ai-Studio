// PD-SAAS-FORK: pluggable document import provider registry
import type {
  DocumentImportContext,
  DocumentImportProvider,
  ImportInput,
  ImportResult,
  IntegrationLevel,
} from "./types.js";

export class DocumentImportProviderRegistry {
  private readonly providers: DocumentImportProvider[] = [];

  register(provider: DocumentImportProvider): void {
    const idx = this.providers.findIndex((p) => p.id === provider.id);
    if (idx >= 0) {
      this.providers[idx] = provider;
      return;
    }
    this.providers.push(provider);
  }

  list(): readonly DocumentImportProvider[] {
    return [...this.providers].sort((a, b) => b.priority - a.priority);
  }

  isEnabled(ctx: DocumentImportContext, providerId: string): boolean {
    const flag = ctx.documentImport.enabledProviders[providerId];
    return flag !== false;
  }

  candidates(ctx: DocumentImportContext, input: ImportInput): DocumentImportProvider[] {
    return this.list().filter((provider) => {
      if (!provider.kinds.includes(input.kind)) return false;
      if (!this.isEnabled(ctx, provider.id)) return false;
      if (provider.availability(ctx) === "unavailable") return false;
      return provider.canHandle(input, ctx);
    });
  }

  orderByCloudPreference(
    pool: DocumentImportProvider[],
    preference: DocumentImportContext["documentImport"]["cloudPreference"],
  ): DocumentImportProvider[] {
    const cloud = pool.filter((p) => p.integrationLevel === "cloud");
    const local = pool.filter((p) => p.integrationLevel !== "cloud");
    if (preference === "cloud_first") return [...cloud, ...local];
    if (preference === "local_only") return local;
    return [...local, ...cloud];
  }

  async parseWithFallback(
    ctx: DocumentImportContext,
    input: ImportInput,
  ): Promise<ImportResult> {
    const pool = this.candidates(ctx, input);
    const ordered = this.orderByCloudPreference(pool, ctx.documentImport.cloudPreference);
    let lastInsufficient: ImportResult | undefined;
    let lastError: Error | undefined;

    for (const provider of ordered) {
      if (provider.availability(ctx) === "needs_config" && provider.integrationLevel === "cloud") {
        continue;
      }
      const started = Date.now();
      try {
        const result = await provider.parse(ctx, input);
        if (result.status === "insufficient_content") {
          lastInsufficient = { ...result, durationMs: Date.now() - started };
          continue;
        }
        return { ...result, durationMs: Date.now() - started };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (lastInsufficient) {
      return lastInsufficient;
    }

    return {
      status: "skipped",
      charCount: 0,
      durationMs: 0,
      reason: lastError?.message ?? "No import provider available for this file.",
    };
  }
}

let defaultRegistry: DocumentImportProviderRegistry | null = null;

export function getDocumentImportRegistry(): DocumentImportProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DocumentImportProviderRegistry();
  }
  return defaultRegistry;
}

export function resetDocumentImportRegistryForTests(): void {
  defaultRegistry = null;
}
