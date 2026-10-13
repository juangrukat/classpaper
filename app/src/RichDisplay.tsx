import React from "react";
import DOMPurify from "dompurify";
import type { Question, PublicQuestion } from "./domain";
export function cleanHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "sup",
      "sub",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h2",
      "h3",
    ],
    ALLOWED_ATTR: ["style", "type", "start", "dir"],
  });
}
export function QuestionText({
  q,
  slot,
}: {
  q: Pick<Question | PublicQuestion, "text" | "richText">;
  slot?: React.ReactNode | ((index: number) => React.ReactNode);
}) {
  if (slot) {
    const html = q.richText
      ? cleanHtml(q.richText)
      : `<p>${q.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
    const doc = new DOMParser().parseFromString(html, "text/html");
    let slotIndex = 0;
    const render = (n: Node, key: number): React.ReactNode => {
      if (n.nodeType === Node.TEXT_NODE)
        return (n.textContent || "")
          .split(/(___)/g)
          .map((part, i) =>
            part === "___" ? (
              <React.Fragment key={i}>
                {typeof slot === "function" ? slot(slotIndex++) : slot}
              </React.Fragment>
            ) : (
              part
            ),
          );
      if (n.nodeType !== Node.ELEMENT_NODE) return null;
      const el = n as HTMLElement;
      const attrs: Record<string, unknown> = { key };
      if (el.style.textAlign) attrs.style = { textAlign: el.style.textAlign };
      for (const a of ["dir", "type", "start"])
        if (el.hasAttribute(a)) attrs[a] = el.getAttribute(a);
      return React.createElement(
        el.tagName.toLowerCase(),
        attrs,
        ...Array.from(el.childNodes).map(render),
      );
    };
    return (
      <div className="rich-display inline-question">
        {Array.from(doc.body.childNodes).map(render)}
      </div>
    );
  }
  return q.richText ? (
    <div
      className="rich-display"
      dangerouslySetInnerHTML={{ __html: cleanHtml(q.richText) }}
    />
  ) : (
    <span className="plain-question">{q.text}</span>
  );
}
