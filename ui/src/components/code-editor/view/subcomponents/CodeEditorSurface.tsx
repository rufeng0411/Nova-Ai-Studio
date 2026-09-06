import { useMemo, type ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { Extension } from '@codemirror/state';
import { resolveProjectInlineMediaUrl } from '../../../../shared/projectInlineMediaUrl';
import { resolveEditorApiPath } from '../../utils/resolveEditorApiPath';
import { isCsvEditorFile } from '../../utils/previewableFile';
import { classifyDeliverablePath } from '../../../../shared/artifactPaths';
import { zincDarkTheme, zincLightTheme } from '../../utils/zincThemes';
import ProjectFilePreview from '../../../shared/ProjectFilePreview';
import PreviewSurfaceShell from '../../../shared/PreviewSurfaceShell';
import { supportsUnifiedFilePreview } from '../../../../shared/projectPreviewCapabilities';
import { SpreadsheetSheetsPreview } from '../../../super-preview/adapters/spreadsheet/SpreadsheetPreviewAdapter';
import { parseDelimitedPreviewRows } from '../../../super-preview/adapters/spreadsheet/spreadsheetPreviewUtils';

type CodeEditorSurfaceProps = {
 content: string;
 onChange: (value: string) => void;
 previewMode: boolean;
 fileName: string;
 isMarkdownFile: boolean;
 isHtmlFile: boolean;
 htmlPreviewPath: string;
 /** PD-SAAS-FORK: turn-scoped dir so the sidebar preview's secondary resolve stays five-entry consistent */
 hintDir?: string;
 projectName?: string;
 projectPath?: string;
 isDarkMode: boolean;
 fontSize: number;
 showLineNumbers: boolean;
 extensions: Extension[];
  previewChromeActions?: ReactNode;
  previewChromeTrailing?: ReactNode;
};

export default function CodeEditorSurface({
 content,
 onChange,
 previewMode,
 fileName,
 isMarkdownFile,
 isHtmlFile,
 htmlPreviewPath,
 hintDir,
 projectName,
 projectPath,
 isDarkMode,
 fontSize,
 showLineNumbers,
 extensions,
 previewChromeActions,
 previewChromeTrailing,
}: CodeEditorSurfaceProps) {
 const isCsvFile = isCsvEditorFile(fileName);

 const csvRows = useMemo(() => {
 if (!previewMode || !isCsvFile) return [];
 const delimiter = fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
 return parseDelimitedPreviewRows(content, delimiter);
 }, [content, fileName, isCsvFile, previewMode]);

 if (previewMode && isCsvFile) {
   return <SpreadsheetSheetsPreview sheets={[{ name: '编辑中', rows: csvRows }]} />;
 }

 // PD-SAAS-FORK: Markdown / HTML 等统一走 ProjectFilePreview → SuperPreviewShell（含「引用」）
 if (previewMode && projectName && supportsUnifiedFilePreview(fileName)) {
 const apiPath = resolveEditorApiPath(htmlPreviewPath, projectPath);
 const kind = classifyDeliverablePath(fileName);
 const previewUrl = resolveProjectInlineMediaUrl(projectName, apiPath, fileName, projectPath || '', kind);
 return (
 <PreviewSurfaceShell fileName={fileName} kind={kind} className="h-full min-h-0 w-full">
 <ProjectFilePreview
 projectName={projectName}
 apiPath={apiPath}
 fileName={fileName}
 kind={kind}
 previewUrl={previewUrl}
 projectRoot={projectPath}
 hintDir={hintDir}
 documentCanvasVariant="sidebar"
 className="h-full w-full min-h-0"
 previewChromeActions={previewChromeActions}
 previewChromeTrailing={previewChromeTrailing}
 />
 </PreviewSurfaceShell>
 );
 }

 return (
 <CodeMirror
 value={content}
 onChange={onChange}
 extensions={extensions}
 theme={isDarkMode ? zincDarkTheme : zincLightTheme}
 height="100%"
 style={{
 fontSize: `${fontSize}px`,
 height: '100%',
 }}
 basicSetup={{
 lineNumbers: showLineNumbers,
 foldGutter: true,
 dropCursor: false,
 allowMultipleSelections: false,
 indentOnInput: true,
 bracketMatching: true,
 closeBrackets: true,
 autocompletion: true,
 highlightSelectionMatches: true,
 searchKeymap: true,
 }}
 />
 );
}
