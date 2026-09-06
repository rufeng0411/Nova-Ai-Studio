export type CodeEditorDiffInfo = {
  old_string?: string;
  new_string?: string;
  [key: string]: unknown;
};

export type CodeEditorFile = {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: CodeEditorDiffInfo | null;
  /** When true, the side editor opens in preview mode (HTML iframe / rendered markdown). */
  initialPreview?: boolean;
  /** PD-SAAS-FORK: design canvas mode for SuperPreview sidebar */
  designCanvasMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HTML Studio mode for SuperPreview sidebar */
  htmlStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HyperFrames Studio mode for SuperPreview sidebar */
  hfStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: Bento deck mode for SuperPreview sidebar */
  bentoStudioMode?: 'view' | 'edit';
  hintDir?: string;
  skipResolve?: boolean;
  [key: string]: unknown;
};

export type CodeEditorSettingsState = {
  isDarkMode: boolean;
  wordWrap: boolean;
  minimapEnabled: boolean;
  showLineNumbers: boolean;
  fontSize: string;
};
