import { AlertCircle, BookOpen, FileText, X } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { type Question } from "./domain";

export function Button({
  children,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`${secondary ? "btn secondary" : "btn"} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    ref.current?.querySelector<HTMLElement>("button,input")?.focus();
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
    </div>
  ) : null;
}

export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={32} />
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </div>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <span>
        <BookOpen size={23} />
      </span>
      classpaper<span className="brand-dot">.</span>
    </div>
  );
}

export function answerText(q: Question) {
  if (q.type === "selection" && q.selections?.length)
    return q.selections
      .map((s) => s.choices.find((c) => c.correct)?.text || "")
      .join("; ");
  if (["multiple", "truefalse", "selection", "checklist"].includes(q.type))
    return q.choices
      .filter((c) => c.correct)
      .map((c) => c.text)
      .join(", ");
  if (["matching", "multimatch"].includes(q.type))
    return q.pairs.map((p) => `${p.left} → ${p.right}`).join("; ");
  if (["list", "listprompt", "statements", "multipart"].includes(q.type))
    return q.pairs
      .map((p) => (q.type === "list" ? p.left : `${p.left} → ${p.right}`))
      .join("; ");
  if (q.type === "table")
    return q.table
      .flat()
      .filter((c) => c.blank)
      .map((c) => c.text)
      .join("; ");
  if (q.type === "ordering") return q.pairs.map((p) => p.left).join(" → ");
  return q.answer;
}
