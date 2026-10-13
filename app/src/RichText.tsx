import { cleanHtml } from "./RichDisplay";
import { Extension } from "@tiptap/core";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import type { PublicQuestion, Question } from "./domain";
const ListStyle = Extension.create({
  name: "listStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["orderedList"],
        attributes: {
          type: {
            default: "1",
            parseHTML: (element) => element.getAttribute("type") || "1",
            renderHTML: (attrs) => ({ type: attrs.type }),
          },
        },
      },
    ];
  },
});
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function RichTextEditor({
  q,
  change,
}: {
  q: Question;
  change: (p: Partial<Question>) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
      ListStyle,
    ],
    content: q.richText
      ? cleanHtml(q.richText)
      : q.text
          .split("\n")
          .map((line) => `<p>${escape(line)}</p>`)
          .join(""),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Question text",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.ctrlKey && event.shiftKey && event.key === " ") {
          editor?.commands.insertContent("\u00a0");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) =>
      change({
        richText: editor.getHTML(),
        text: editor.getText({ blockSeparator: "\n" }),
      }),
  });
  if (!editor) return null;
  const command = (action: () => void) => {
    action();
  };
  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="Text formatting">
        {["blanks", "selection"].includes(q.type) && (
          <button
            type="button"
            className="make-blank"
            onClick={() => {
              const { from, to } = editor.state.selection;
              const selected = editor.state.doc
                .textBetween(from, to, " ")
                .trim();
              if (!selected) return;
              editor.chain().focus().insertContent("___").run();
              change({
                text: editor.getText({ blockSeparator: "\n" }),
                richText: editor.getHTML(),
                ...(q.type === "blanks"
                  ? { answer: q.answer ? `${q.answer}|${selected}` : selected }
                  : {
                      choices: q.choices.map((c, i) =>
                        i === 0
                          ? { ...c, text: selected, correct: true }
                          : { ...c, correct: false },
                      ),
                    }),
              });
            }}
          >
            Make selected text a blank
          </button>
        )}
        <button
          type="button"
          aria-label="Bold"
          title="Bold (Ctrl+B)"
          onClick={() =>
            command(() => editor.chain().focus().toggleBold().run())
          }
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          aria-label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          aria-label="Superscript"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          x²
        </button>
        <button
          type="button"
          aria-label="Subscript"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          x₂
        </button>
        <select
          aria-label="Text alignment"
          defaultValue="left"
          onChange={(e) =>
            editor.chain().focus().setTextAlign(e.target.value).run()
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
          <option value="justify">Justified</option>
        </select>
        <button
          type="button"
          aria-label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <select
          aria-label="Numbered list style"
          defaultValue=""
          onChange={(e) => {
            if (!editor.isActive("orderedList"))
              editor.chain().focus().toggleOrderedList().run();
            editor
              .chain()
              .focus()
              .updateAttributes("orderedList", { type: e.target.value })
              .run();
          }}
        >
          <option value="" disabled>
            Numbered list
          </option>
          <option value="1">1, 2, 3</option>
          <option value="a">a, b, c</option>
          <option value="A">A, B, C</option>
          <option value="i">i, ii, iii</option>
          <option value="I">I, II, III</option>
        </select>
        <select
          aria-label="Insert symbol"
          value=""
          onChange={(e) =>
            editor.chain().focus().insertContent(e.target.value).run()
          }
        >
          <option value="">Symbols</option>
          {[
            "—",
            "\u00a0",
            "\u2011",
            "°",
            "±",
            "×",
            "÷",
            "π",
            "≤",
            "≥",
            "√",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "\u00a0"
                ? "Nonbreaking space"
                : s === "\u2011"
                  ? "Nonbreaking hyphen"
                  : s}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Undo text edit"
          onClick={() => editor.chain().focus().undo().run()}
        >
          ↶
        </button>
      </div>
      <EditorContent editor={editor} />
      <small className="hint">
        Type your question here. Formatting also appears in student and print
        views.
      </small>
    </div>
  );
}
