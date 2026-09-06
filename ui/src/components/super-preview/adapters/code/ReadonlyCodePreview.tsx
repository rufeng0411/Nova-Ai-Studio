import { Copy } from 'lucide-react';
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getLanguageExtensions } from '../../../code-editor/utils/editorExtensions';
import { zincDarkTheme, zincLightTheme } from '../../../code-editor/utils/zincThemes';
import { cn } from '../../../../lib/utils';

type ReadonlyCodePreviewProps = {
  content: string;
  fileName: string;
  embedInChrome?: boolean;
  className?: string;
};

export default function ReadonlyCodePreview({
  content,
  fileName,
  embedInChrome = false,
  className,
}: ReadonlyCodePreviewProps) {
  const { isDarkMode } = useTheme() as { isDarkMode: boolean };

  const extensions = useMemo(
    () => [
      ...getLanguageExtensions(fileName),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ],
    [fileName],
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      {!embedInChrome ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void navigator.clipboard?.writeText(content)}
          >
            <Copy className="h-3.5 w-3.5" />
            复制
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={() => {}}
          extensions={extensions}
          theme={isDarkMode ? zincDarkTheme : zincLightTheme}
          height="100%"
          editable={false}
          style={{
            fontSize: '12px',
            height: '100%',
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            highlightSelectionMatches: true,
            searchKeymap: true,
            highlightActiveLine: true,
          }}
        />
      </div>
    </div>
  );
}
