import { Check } from "lucide-react";
import { useState } from "react";
import {
  shuffle,
  type PublicQuestion,
  type Question,
  type ResponseValue,
} from "./domain";
import { QuestionText } from "./RichDisplay";
import { SpecialResponse, specialKinds } from "./SpecialQuestions";

export function PreviewQuestion({
  q,
  number,
}: {
  q: Question;
  number: number;
}) {
  const [value, setValue] = useState<ResponseValue>("");
  const publicQ: PublicQuestion = {
    id: q.id,
    type: q.type,
    text: q.text,
    richText: q.richText,
    imageAlt: q.imageAlt,
    choiceLimit: 0,
    pageBreak: false,
    keepTogether: true,
    marks: q.marks,
    category: q.category,
    image: q.image,
    group: q.group,
    selections: (q.selections || []).map((s) => ({
      id: s.id,
      choices: s.choices.map(({ id, text }) => ({ id, text })),
    })),
    choices: q.choices.map(({ id, text }) => ({ id, text })),
    table: (q.table || []).map((row) =>
      row.map((c) => ({ ...c, text: c.blank ? "" : c.text })),
    ),
    pairs:
      q.type === "ordering"
        ? shuffle(
            q.pairs.map(({ id, left, marks }) => ({
              id,
              left: q.type === "list" ? "" : left,
              marks,
            })),
          )
        : q.pairs.map(({ id, left, marks }) => ({
            id,
            left: q.type === "list" ? "" : left,
            marks,
          })),
    options: shuffle([
      ...new Set(
        [...(q.matchOptions || []), ...q.pairs.map((p) => p.right)].filter(
          (x) => x.trim(),
        ),
      ),
    ]),
    multiple:
      q.type === "checklist" || q.choices.filter((c) => c.correct).length > 1,
  };
  return (
    <div className="student-question">
      <div className="student-q-head">
        <span className="question-number">{number}</span>
        <span className="muted">{q.marks} marks</span>
      </div>
      <div className="question-body">
        <QuestionText
          q={q}
          slot={
            q.type === "selection"
              ? (index: number) => (
                  <InlineChoice
                    q={publicQ}
                    index={index}
                    value={value}
                    change={setValue}
                  />
                )
              : undefined
          }
        />
      </div>
      {q.image && (
        <img
          className="student-image"
          src={q.image}
          alt={q.imageAlt || "Question illustration"}
        />
      )}
      <ResponseInput q={publicQ} value={value} change={setValue} />
    </div>
  );
}

export function ResponseInput({
  q,
  value,
  change,
}: {
  q: PublicQuestion;
  value: ResponseValue | undefined;
  change: (v: ResponseValue) => void;
}) {
  if (["multiple", "truefalse", "selection", "checklist"].includes(q.type)) {
    if (q.type === "selection") return null;
    const checked = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];
    return (
      <div className="student-choices">
        {q.choices.map((c, i) => (
          <label key={c.id} className={checked.includes(c.id) ? "checked" : ""}>
            <input
              type={q.multiple ? "checkbox" : "radio"}
              name={q.id}
              value={c.id}
              checked={checked.includes(c.id)}
              onChange={(e) =>
                change(
                  q.multiple
                    ? e.target.checked
                      ? [...checked, c.id]
                      : checked.filter((x) => x !== c.id)
                    : c.id,
                )
              }
            />
            <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
            <span>{c.text}</span>
          </label>
        ))}
        {q.multiple && (
          <small className="hint">Select all correct answers.</small>
        )}
      </div>
    );
  }
  if (q.type === "short" || q.type === "essay")
    return (
      <label>
        Your answer
        <textarea
          rows={q.type === "essay" ? 7 : 3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => change(e.target.value)}
          placeholder="Write your answer here…"
        />
      </label>
    );
  if (q.type === "numerical")
    return (
      <label>
        Your answer
        <input
          type="text"
          inputMode="decimal"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => change(e.target.value)}
          placeholder="Enter a number"
        />
      </label>
    );
  if (q.type === "blanks") {
    const count = q.text.split("___").length - 1;
    const a = Array.isArray(value) ? value : Array(count).fill("");
    return (
      <div className="blank-inputs">
        {Array.from({ length: count }, (_, i) => (
          <label key={i}>
            Blank {i + 1}
            <input
              value={a[i] || ""}
              onChange={(e) => {
                const next = Array.from(
                  { length: count },
                  (_, j) => a[j] || "",
                );
                next[i] = e.target.value;
                change(next);
              }}
            />
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "matching" || q.type === "multimatch") {
    const a =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <div className="student-pairs">
        {q.pairs.map((p) => (
          <label key={p.id}>
            <span>{p.left}</span>
            <select
              value={a[p.id] || ""}
              onChange={(e) => change({ ...a, [p.id]: e.target.value })}
            >
              <option value="">Choose a match…</option>
              {q.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "ordering") {
    const order =
      Array.isArray(value) && value.length === q.pairs.length
        ? value
        : q.pairs.map((p) => p.id);
    return (
      <>
        <p className="hint">
          Use the arrows to put the items in the correct order.
        </p>
        {order.map((id, i) => (
          <div className="order-row" key={id}>
            <span>{i + 1}</span>
            <strong>{q.pairs.find((p) => p.id === id)?.left}</strong>
            <button
              className="icon"
              disabled={i === 0}
              aria-label={`Move item ${i + 1} up`}
              onClick={() => {
                const next = [...order];
                [next[i], next[i - 1]] = [next[i - 1], next[i]];
                change(next);
              }}
            >
              ↑
            </button>
            <button
              className="icon"
              disabled={i === order.length - 1}
              aria-label={`Move item ${i + 1} down`}
              onClick={() => {
                const next = [...order];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                change(next);
              }}
            >
              ↓
            </button>
          </div>
        ))}
        <button className="text-button" onClick={() => change(order)}>
          Confirm this order <Check size={16} />
        </button>
      </>
    );
  }
  if (specialKinds.includes(q.type))
    return <SpecialResponse q={q} value={value} change={change} />;
  return null;
}

export function InlineChoice({
  q,
  index = 0,
  value,
  change,
}: {
  q: PublicQuestion;
  index?: number;
  value: ResponseValue | undefined;
  change: (v: ResponseValue) => void;
}) {
  const selection = q.selections?.[index];
  const values =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return (
    <select
      className="inline-select"
      aria-label={`Choose missing word ${index + 1}`}
      value={
        selection
          ? values[selection.id] || ""
          : typeof value === "string"
            ? value
            : ""
      }
      onChange={(e) =>
        change(
          selection
            ? { ...values, [selection.id]: e.target.value }
            : e.target.value,
        )
      }
    >
      <option value="">Choose…</option>
      {(selection?.choices || q.choices).map((c) => (
        <option key={c.id} value={c.id}>
          {c.text}
        </option>
      ))}
    </select>
  );
}
