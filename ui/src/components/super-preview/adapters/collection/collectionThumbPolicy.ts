import {
  isMarkdownEditorFile,
  isTextPreviewFile,
} from '../../../code-editor/utils/previewableFile';

/** Matrix thumbs: only human-readable prose snippets; never raw JSON/config. */
export function shouldShowTextSnippetInCollectionThumb(fileName: string): boolean {
  return isMarkdownEditorFile(fileName) || isTextPreviewFile(fileName);
}
