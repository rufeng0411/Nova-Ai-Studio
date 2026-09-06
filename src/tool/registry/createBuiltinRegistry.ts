import type { BackgroundTaskRuntime } from "../../task/runtime/BackgroundTaskRuntime.js";
import { createAgentTool, type CreateAgentToolOptions } from "../builtin/agent.js";
import { createAskUserQuestionTool } from "../builtin/askUserQuestion.js";
import { createBashTool, type CreateBashToolOptions } from "../builtin/bash.js";
import { createEditFileTool } from "../builtin/editFile.js";
import { createEditNotebookTool } from "../builtin/editNotebook.js";
import { createGlobTool } from "../builtin/glob.js";
import { createGrepTool } from "../builtin/grep.js";
import { createReadFileTool, type CreateReadFileToolOptions } from "../builtin/readFile.js";
import { createEnterPlanModeTool, createExitPlanModeTool } from "../builtin/planMode.js";
import { createStructuredOutputTool } from "../builtin/structuredOutput.js";
import { createTodoWriteTool } from "../builtin/todoWrite.js";
import {
  createTaskCreateTool,
  createTaskListTool,
  createTaskOutputTool,
  createTaskStopTool,
} from "../builtin/taskTools.js";
import { createWebFetchTool, type CreateWebFetchToolOptions } from "../builtin/webFetch.js";
import { createFetchPageImagesTool, type CreateFetchPageImagesToolOptions } from "../builtin/fetchPageImages.js";
import {
  createFetchMediaAssetTool,
  type CreateFetchMediaAssetToolOptions,
} from "../builtin/fetchMediaAsset.js";
import { createResolveSessionVisualAssetsTool } from "../builtin/resolveSessionVisualAssets.js";
import { createPrepareVisualAssetTool } from "../builtin/prepareVisualAsset.js";
import { createIngestVisualAssetTool } from "../builtin/ingestVisualAsset.js";
import { visualAssetPlatformMode } from "../../saas/resilience/stabilityFlags.js";
import { createScaffoldMobileMockupTool } from "../builtin/scaffoldMobileMockup.js";
import { createWebSearchTool, type CreateWebSearchToolOptions } from "../builtin/webSearch.js";
import { createGenerateImageTool, type CreateGenerateImageToolOptions } from "../builtin/generateImage.js";
import { createGenerateVideoTool, type CreateGenerateVideoToolOptions } from "../builtin/generateVideo.js";
import { createGenerateSpeechTool, type CreateGenerateSpeechToolOptions } from "../builtin/generateSpeech.js";
import { createTranscribeAudioTool, type CreateTranscribeAudioToolOptions } from "../builtin/transcribeAudio.js";
import { createRenderHtmlVideoTool } from "../builtin/renderHtmlVideo.js";
import { createRenderHyperframesTool } from "../builtin/renderHyperframes.js";
import { isHyperframesEngineEnabled } from "../../saas/media/hyperframesEngineFlags.js";
import {
  createRenderLocalHtmlToImageTool,
  type CreateRenderLocalHtmlToImageToolOptions,
} from "../builtin/renderLocalHtmlToImage.js";
import {
  createComposeImagesToDocumentTool,
  type CreateComposeImagesToDocumentToolOptions,
} from "../builtin/composeImagesToDocument.js";
import {
  createOcrToEditablePptxTool,
  type CreateOcrToEditablePptxToolOptions,
} from "../builtin/ocrToEditablePptx.js";
import {
  createExportDocumentTool,
  type CreateExportDocumentToolOptions,
} from "../builtin/exportDocument.js";
import { createGeoApiTool, type CreateGeoApiToolOptions } from "../builtin/geoApi.js";
import { createYixiaoerApiTool, type CreateYixiaoerApiToolOptions } from "../builtin/yixiaoerApi.js";
import { createReadSkillTool, type ReadSkillDeps } from "../builtin/readSkill.js";
import { createWriteFileTool } from "../builtin/writeFile.js";
import {
  createCanvasAddAssetTool,
  createCanvasAddDiagramTool,
  createCanvasReadBoardTool,
  createCanvasUpdateManifestTool,
} from "../builtin/canvasTools.js";
import { isDesignCanvasToolsEnabled } from "../../saas/designCanvasGate.js";
import { ToolRegistry } from "./ToolRegistry.js";

export type CreateBuiltinRegistryOptions = {
  bash?: CreateBashToolOptions;
  /**
   * `web_search` defaults to the GLM/Z.AI provider. Pass `false` to skip
   * registering web_search; pass an options object to select GLM or Tavily
   * and customize apiKey / endpoint.
   */
  webSearch?: CreateWebSearchToolOptions | false;
  /**
   * `generate_image` network tool. Pass `false` to skip registration.
   */
  image?: CreateGenerateImageToolOptions | false;
  /**
   * `generate_video` network tool. Pass `false` to skip registration.
   */
  video?: CreateGenerateVideoToolOptions | false;
  /**
   * `generate_speech` network tool. Pass `false` to skip registration.
   */
  tts?: CreateGenerateSpeechToolOptions | false;
  /**
   * `transcribe_audio` network tool. Pass `false` to skip registration.
   */
  speech?: CreateTranscribeAudioToolOptions | false;
  /**
   * `agent` subagent tool. **Opt-in** because it requires a model client at
   * execution time — the AgentLoop forwards the loop's model client through
   * `PilotDeckToolRuntimeContext.model`, but stand-alone tool runtimes (e.g.
   * tests) may not have one. Pass `true` (default) to register; pass `false`
   * to skip; pass an options object to customize the subagent presets or
   * lock the provider/model.
   */
  agent?: CreateAgentToolOptions | boolean;
  /**
   * `web_fetch` builtin tool. **Opt-in** (default: registered) because it
   * issues HTTP requests and a secondary model call. Pass `false` to skip.
   * Pass an options object to override the provider / model id used for the
   * secondary model call. Without a model client the tool returns the raw
   * markdown without summarization.
   */
  webFetch?: CreateWebFetchToolOptions | false;
  /**
   * `fetch_page_images` — model-free page image URL extraction. Registered by
   * default. Pass `false` to skip.
   */
  fetchPageImages?: CreateFetchPageImagesToolOptions | false;
  /** PD-SAAS-FORK P0-4: bound official candidate localization. */
  fetchMediaAsset?: CreateFetchMediaAssetToolOptions | false;
  /** PD-SAAS-FORK P0-5: offline task-local HTML screenshot rendering. */
  renderLocalHtmlToImage?:
    | CreateRenderLocalHtmlToImageToolOptions
    | false;
  /**
   * Background task tools (`task_create` / `task_list` / `task_output` /
   * `task_stop`). **Opt-in** — pass `{ runtime }` to register; absent or
   * `false` keeps them out of the registry. Stand-alone runtimes that do
   * not provide a `BackgroundTaskRuntime` would otherwise see every call
   * fail with `unsupported_tool`.
   */
  backgroundTasks?: { runtime: BackgroundTaskRuntime } | false;
  /**
   * `structured_output` builtin (A3). Registered by default — the tool is
   * inert without a model client requesting it via `tool_choice`, but the
   * registry must contain it so non-interactive hosts can opt in. Pass
   * `false` to skip.
   */
  structuredOutput?: false;
  /**
   * `ask_user_question` builtin (B1). Registered by default; an absent
   * `PilotDeckElicitationChannel` at execution time causes the tool to
   * return a runtime error rather than crash the loop. Pass `false` to
   * skip registration in headless contexts.
   */
  askUserQuestion?: false;
  /**
   * `read_skill` builtin. **Opt-in** — pass `{ loader, lister }` to
   * register; absent or `false` keeps it out of the registry. The loader
   * fetches skill content by name; the lister enumerates available skill
   * names for the "not found" diagnostic message.
   */
  readSkill?: ReadSkillDeps | false;
  /**
   * `yixiaoer_api` builtin. Registered when YiXiaoEr API key is configured.
   */
  yixiaoer?: CreateYixiaoerApiToolOptions | false;
  /**
   * `geo_api` builtin (PD-SAAS-FORK). Registered by default for AI search visibility.
   */
  geo?: CreateGeoApiToolOptions | false;
  /** PD-SAAS-FORK: compose_images_to_document */
  documentCompose?: CreateComposeImagesToDocumentToolOptions | false;
  /** PD-SAAS-FORK: ocr_to_editable_pptx */
  documentOcr?: CreateOcrToEditablePptxToolOptions | false;
  /** PD-SAAS-FORK: export_document */
  documentExport?: CreateExportDocumentToolOptions | false;
  /** PD-SAAS-FORK: read_file office import */
  readFile?: CreateReadFileToolOptions | false;
  /**
   * `enter_plan_mode` / `exit_plan_mode` builtins. Registered by default —
   * these lightweight skeleton tools let the model request a permission-mode
   * switch to plan (read-only) and back. Pass `false` to skip.
   */
  planMode?: false;
};

export function createBuiltinRegistry(options?: CreateBuiltinRegistryOptions): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(createReadFileTool(options?.readFile === false ? undefined : options?.readFile));
  registry.register(createGlobTool());
  registry.register(createGrepTool());
  registry.register(createEditFileTool());
  registry.register(createEditNotebookTool());
  registry.register(createWriteFileTool());
  registry.register(createBashTool(options?.bash));
  if (options?.webSearch !== false) {
    registry.register(createWebSearchTool(options?.webSearch));
  }
  if (options?.image !== false) {
    registry.register(createGenerateImageTool(options?.image));
  }
  if (options?.video !== false) {
    registry.register(createGenerateVideoTool(options?.video));
  }
  if (options?.tts !== false) {
    registry.register(createGenerateSpeechTool(options?.tts));
  }
  if (options?.speech !== false) {
    registry.register(createTranscribeAudioTool(options?.speech));
  }
  registry.register(createRenderHtmlVideoTool());
  if (isHyperframesEngineEnabled()) {
    registry.register(createRenderHyperframesTool());
  }
  if (options?.renderLocalHtmlToImage !== false) {
    // PD-SAAS-FORK P0-5: registered by default; Chromium work is semaphore-bound.
    registry.register(
      createRenderLocalHtmlToImageTool(
        options?.renderLocalHtmlToImage,
      ),
    );
  }
  if (options?.documentCompose !== false) {
    registry.register(createComposeImagesToDocumentTool(options?.documentCompose));
  }
  if (options?.documentOcr !== false) {
    registry.register(createOcrToEditablePptxTool(options?.documentOcr));
  }
  if (options?.documentExport !== false) {
    registry.register(createExportDocumentTool(options?.documentExport));
  }
  if (options?.webFetch !== false) {
    registry.register(createWebFetchTool(options?.webFetch));
  }
  if (options?.fetchPageImages !== false) {
    registry.register(createFetchPageImagesTool(options?.fetchPageImages));
  }
  if (options?.fetchMediaAsset !== false) {
    // PD-SAAS-FORK P0-4: raw URLs never enter this tool's model-visible input.
    registry.register(
      createFetchMediaAssetTool(options?.fetchMediaAsset),
    );
  }
  // PD-SAAS-FORK VAP: visual asset platform tools (gated by PILOTDECK_VISUAL_ASSET_PLATFORM).
  if (visualAssetPlatformMode() !== "off") {
    registry.register(createResolveSessionVisualAssetsTool());
    registry.register(createPrepareVisualAssetTool());
    registry.register(createIngestVisualAssetTool());
  }
  // PD-SAAS-FORK: mobile UI mockup scaffold (od-mobile-app)
  registry.register(createScaffoldMobileMockupTool());
  if (options?.agent !== false) {
    const agentOpts = options?.agent === true || options?.agent === undefined ? undefined : options.agent;
    registry.register(createAgentTool(agentOpts));
  }
  if (options?.backgroundTasks) {
    const runtime = options.backgroundTasks.runtime;
    registry.register(createTaskCreateTool(runtime));
    registry.register(createTaskListTool(runtime));
    registry.register(createTaskOutputTool(runtime));
    registry.register(createTaskStopTool(runtime));
  }
  if (options?.structuredOutput !== false) {
    registry.register(createStructuredOutputTool());
  }
  if (options?.askUserQuestion !== false) {
    registry.register(createAskUserQuestionTool());
  }
  if (options?.planMode !== false) {
    registry.register(createEnterPlanModeTool());
    registry.register(createExitPlanModeTool());
  }
  registry.register(createTodoWriteTool());
  if (options?.readSkill) {
    registry.register(createReadSkillTool(options.readSkill));
  }
  if (options?.yixiaoer !== false && options?.yixiaoer) {
    registry.register(createYixiaoerApiTool(options.yixiaoer));
  }
  if (options?.geo !== false) {
    const geoOpts = options?.geo && typeof options.geo === "object" ? options.geo : undefined;
    registry.register(createGeoApiTool(geoOpts));
  }
  if (isDesignCanvasToolsEnabled()) {
    registry.register(createCanvasReadBoardTool());
    registry.register(createCanvasAddAssetTool());
    registry.register(createCanvasAddDiagramTool());
    registry.register(createCanvasUpdateManifestTool());
  }
  return registry;
}
