// PD-SAAS-FORK: pluggable document export provider registry
import type {
  DocumentExportContext,
  DocumentExportProvider,
  DocumentIr,
  ExportInput,
  ExportResult,
  IntegrationLevel,
  OutputFormat,
} from "./types.js";

export class DocumentExportProviderRegistry {
  private readonly providers: DocumentExportProvider[] = [];

  register(provider: DocumentExportProvider): void {
    const existing = this.providers.findIndex((p) => p.id === provider.id);
    if (existing >= 0) {
      this.providers[existing] = provider;
      return;
    }
    this.providers.push(provider);
  }

  list(): readonly DocumentExportProvider[] {
    return [...this.providers].sort((a, b) => b.priority - a.priority);
  }

  isEnabled(ctx: DocumentExportContext, providerId: string): boolean {
    const flag = ctx.documentExport.enabledProviders[providerId];
    if (flag === false) return false;
    return true;
  }

  candidates(
    ctx: DocumentExportContext,
    input: ExportInput,
    ir: DocumentIr,
    format: OutputFormat,
  ): DocumentExportProvider[] {
    return this.list().filter((provider) => {
      if (!provider.formats.includes(format)) return false;
      if (!this.isEnabled(ctx, provider.id)) return false;
      if (provider.availability(ctx) === "unavailable") return false;
      return provider.canHandle(input, ir);
    });
  }

  async renderWithFallback(
    ctx: DocumentExportContext,
    input: ExportInput,
    ir: DocumentIr,
  ): Promise<ExportResult> {
    const preferCloud = input.options.cloud_preference ?? ctx.documentExport.cloudPreference;
    const pool = this.candidates(ctx, input, ir, input.outputFormat);
    const cloud = preferCloud === "cloud_first"
      ? pool.filter((p) => p.integrationLevel === "cloud")
      : [];
    const local = pool.filter((p) => p.integrationLevel !== "cloud");
    const ordered = preferCloud === "cloud_first" ? [...cloud, ...local] : [...local, ...cloud];

    let lastError: Error | undefined;
    for (const provider of ordered) {
      if (provider.availability(ctx) === "needs_config" && provider.integrationLevel === "cloud") {
        continue;
      }
      try {
        return await provider.render(ctx, input, ir);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error(`No provider available for format ${input.outputFormat}`);
  }
}

let defaultRegistry: DocumentExportProviderRegistry | null = null;

export function getDocumentExportRegistry(): DocumentExportProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DocumentExportProviderRegistry();
  }
  return defaultRegistry;
}

export function resetDocumentExportRegistryForTests(): void {
  defaultRegistry = null;
}
