import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Current HTML value. */
  value: string;
  /** Fires when the user edits the content. */
  onChange: (html: string) => void;
  /** Disables both editing and toolbar (e.g., while AI is streaming). */
  disabled?: boolean;
  /** Min-height tailwind class for the editing area. */
  minHeightClass?: string;
  placeholder?: string;
}

interface ToolButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolButton({ active, disabled, onClick, title, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor focus on click
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Email-client-style rich text editor wrapping TipTap. Supports bold,
 * italic, underline, headings, lists, blockquote, undo/redo. Designed for
 * the sidebar draft flow — the email body is HTML, ready to copy into a
 * mail client that accepts HTML.
 */
export default function RichTextEditor({
  value,
  onChange,
  disabled,
  minHeightClass = "min-h-[300px]",
  placeholder,
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-3 py-3 text-sm leading-relaxed",
          // Tighten default Tailwind typography spacing for a denser email feel
          "[&_p]:my-2 [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_blockquote]:my-2",
          minHeightClass,
        ),
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  // Sync external value changes (e.g., AI streaming) into the editor.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    // setContent without triggering onUpdate to avoid feedback loop.
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  // Toggle editable when disabled changes.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border border-input bg-background", minHeightClass)} />
    );
  }

  const isActive = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);

  return (
    <div className="rounded-md border border-input bg-background flex flex-col overflow-hidden">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-muted/40">
        <ToolButton
          title="Bold (⌘B)"
          active={isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Italic (⌘I)"
          active={isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Underline (⌘U)"
          active={isActive("underline")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          title="Heading 1"
          active={isActive("heading", { level: 1 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Heading 2"
          active={isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          title="Bulleted list"
          active={isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Numbered list"
          active={isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Blockquote"
          active={isActive("blockquote")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          title="Undo (⌘Z)"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Redo (⌘⇧Z)"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </ToolButton>
      </div>

      <EditorContent editor={editor} className="flex-1 overflow-y-auto bg-background" />
    </div>
  );
}
