import sanitize from "sanitize-html";
import type { Question } from "../src/domain.js";
export function cleanRichText(value: string) {
  return sanitize(value, {
    allowedTags: [
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
    allowedAttributes: {
      "*": ["dir"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      ol: ["type", "start"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    transformTags: {
      ol: (_tag, attrs) => ({
        tagName: "ol",
        attribs: {
          ...attrs,
          type: /^[1aAiI]$/.test(attrs.type || "") ? attrs.type : "1",
        },
      }),
    },
  });
}
export function cleanQuestions(questions: Question[]) {
  for (const q of questions) {
    q.richText = cleanRichText(q.richText || "");
    if (
      q.imageOriginal &&
      !/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(
        q.imageOriginal,
      )
    )
      throw new Error("Unsupported original image.");
  }
  return questions;
}
