// PD-SAAS-FORK: single-field TipTap inline editor for HTML Studio FieldEditor
import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { cn } from '../../../../lib/utils';

type HtmlFieldEditorProps = {
  value: string;
  active: boolean;
  onChange: (text: string, html: string) => void;
  onBlur?: () => void;
  className?: string;
};

export default function HtmlFieldEditor({
  value,
  active,
  onChange,
  onBlur,
  className,
}: HtmlFieldEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    editable: active,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getText(), ed.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          'min-w-[1ch] outline-none focus:outline-none',
          active && 'ring-1 ring-primary/40 ring-offset-1 rounded-sm',
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(active);
  }, [active, editor]);

  useEffect(() => {
    if (!editor || active) return;
    const current = editor.getText();
    if (current !== value) {
      editor.commands.setContent(value, false);
    }
  }, [active, editor, value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'nova-html-field-editor inline-block max-w-full align-baseline',
        active && 'bg-primary/5',
        className,
      )}
      data-testid="html-field-editor"
    >
      <EditorContent editor={editor} />
    </div>
  );
}
