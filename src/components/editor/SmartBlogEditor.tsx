import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

export default function SmartBlogEditor({
  value,
  onChange,
  placeholder = 'Write or edit the blog content...',
  minHeightClassName = 'min-h-[420px]',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: [
          minHeightClassName,
          'rounded-b-2xl border-x border-b border-gray-200 bg-white px-5 py-4 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white',
          'prose prose-sm max-w-none dark:prose-invert',
          'focus:outline-none',
        ].join(' '),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    const nextHtml = value || '';

    if (currentHtml !== nextHtml) {
      editor.commands.setContent(nextHtml, {
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  const buttonBaseClass = 'rounded-lg px-3 py-1.5 text-sm transition';
  const inactiveButtonClass =
    'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
  const activeButtonClass =
    'bg-gray-900 text-white dark:bg-white dark:text-gray-900';

  const getButtonClass = (isActive: boolean) =>
    `${buttonBaseClass} ${isActive ? activeButtonClass : inactiveButtonClass}`;

  const setLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link')?.href || '';
    const url = window.prompt('Enter link URL', previousUrl);

    if (url === null) return;

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmedUrl }).run();
  };

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-2xl">
      <div className="flex flex-wrap gap-2 rounded-t-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={getButtonClass(editor.isActive('bold'))}
        >
          Bold
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={getButtonClass(editor.isActive('italic'))}
        >
          Italic
        </button>

        <input
          type="color"
          onInput={(event) =>
            editor
              .chain()
              .focus()
              .setColor((event.target as HTMLInputElement).value)
              .run()
          }
          value={editor.getAttributes('textStyle').color || '#111827'}
          className="h-9 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800"
          title="Text color"
        />

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetColor().run()}
          className={`${buttonBaseClass} ${inactiveButtonClass}`}
        >
          Clear Color
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 1 }))}
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 2 }))}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 3 }))}
        >
          H3
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={getButtonClass(editor.isActive('bulletList'))}
        >
          Bullet List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={getButtonClass(editor.isActive('orderedList'))}
        >
          Numbered List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={getButtonClass(editor.isActive('blockquote'))}
        >
          Quote
        </button>

        <button
          type="button"
          onClick={setLink}
          className={getButtonClass(editor.isActive('link'))}
        >
          Link
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={`${buttonBaseClass} ${inactiveButtonClass}`}
        >
          Clear
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}