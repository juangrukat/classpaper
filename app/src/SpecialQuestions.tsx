import { useState } from "react";
import type { PublicQuestion, Question, ResponseValue } from "./domain";
export const specialKinds = [
  "list",
  "listprompt",
  "checklist",
  "statements",
  "table",
  "diagram",
  "multipart",
];
export function SpecialEditor({
  q,
  change,
}: {
  q: Question;
  change: (p: Partial<Question>) => void;
}) {
  if (q.type === "checklist")
    return (
      <p className="hint">
        Use the answer-choice controls below. Students select every correct
        item.
      </p>
    );
  if (q.type === "diagram")
    return (
      <label>
        Answer guide for teacher grading
        <textarea
          rows={4}
          value={q.answer}
          onChange={(e) => change({ answer: e.target.value })}
        />
        <small>
          Upload the diagram above. Students can write a response and attach
          their completed diagram.
        </small>
      </label>
    );
  if (q.type === "table") {
    const table = q.table || [];
    return (
      <div className="table-editor">
        <p className="hint">
          Enter the completed table, then tick the cells students should fill
          in. Unticked cells remain visible.
        </p>
        <div className="table-wrap">
          <table>
            <tbody>
              {table.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={cell.id}>
                      <input
                        aria-label={`Row ${i + 1} column ${j + 1} text`}
                        value={cell.text}
                        onChange={(e) =>
                          change({
                            table: table.map((r, ri) =>
                              r.map((c, ci) =>
                                ri === i && ci === j
                                  ? { ...c, text: e.target.value }
                                  : c,
                              ),
                            ),
                          })
                        }
                      />
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={cell.blank}
                          onChange={(e) =>
                            change({
                              table: table.map((r, ri) =>
                                r.map((c, ci) =>
                                  ri === i && ci === j
                                    ? { ...c, blank: e.target.checked }
                                    : c,
                                ),
                              ),
                            })
                          }
                        />
                        Student fills in
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button
            className="text-button"
            onClick={() =>
              change({
                table: [
                  ...table,
                  Array.from({ length: table[0]?.length || 2 }, () => ({
                    id: crypto.randomUUID(),
                    text: "",
                    blank: false,
                  })),
                ],
              })
            }
          >
            + Add row
          </button>
          <button
            className="text-button"
            disabled={!table.length}
            onClick={() =>
              change({
                table: table.map((row) => [
                  ...row,
                  { id: crypto.randomUUID(), text: "", blank: false },
                ]),
              })
            }
          >
            + Add column
          </button>
          <button
            className="text-button"
            disabled={!table.length}
            onClick={() => change({ table: table.slice(0, -1) })}
          >
            Remove last row
          </button>
        </div>
      </div>
    );
  }
  if (["list", "listprompt", "statements", "multipart"].includes(q.type))
    return (
      <div>
        <p className="hint">
          {q.type === "list"
            ? "Add the expected list items as a private grading guide."
            : q.type === "multipart"
              ? "Add each part, its private answer guide, and marks."
              : q.type === "statements"
                ? "Add statements and mark each as true or false."
                : "Add prompts and a private expected answer for each."}
        </p>
        {q.pairs.map((p, i) => (
          <div className="special-pair" key={p.id}>
            <label>
              {q.type === "list"
                ? `Expected item ${i + 1}`
                : `${q.type === "multipart" ? "Part" : "Prompt"} ${i + 1}`}
              <input
                value={p.left}
                onChange={(e) =>
                  change({
                    pairs: q.pairs.map((x) =>
                      x.id === p.id ? { ...x, left: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            {q.type === "statements" ? (
              <label>
                Correct answer
                <select
                  value={p.right || "True"}
                  onChange={(e) =>
                    change({
                      pairs: q.pairs.map((x) =>
                        x.id === p.id ? { ...x, right: e.target.value } : x,
                      ),
                    })
                  }
                >
                  <option>True</option>
                  <option>False</option>
                </select>
              </label>
            ) : (
              q.type !== "list" && (
                <label>
                  Answer guide
                  <input
                    value={p.right}
                    onChange={(e) =>
                      change({
                        pairs: q.pairs.map((x) =>
                          x.id === p.id ? { ...x, right: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
              )
            )}
            {q.type === "multipart" && (
              <label>
                Part marks
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={p.marks ?? 1}
                  onChange={(e) => {
                    const pairs = q.pairs.map((x) =>
                      x.id === p.id
                        ? { ...x, marks: Number(e.target.value) }
                        : x,
                    );
                    change({
                      pairs,
                      marks: pairs.reduce((s, p) => s + (p.marks ?? 1), 0),
                    });
                  }}
                />
              </label>
            )}
            <button
              className="text-button danger-text"
              onClick={() => {
                const pairs = q.pairs.filter((x) => x.id !== p.id);
                change({
                  pairs,
                  ...(q.type === "multipart"
                    ? { marks: pairs.reduce((s, p) => s + (p.marks ?? 1), 0) }
                    : {}),
                });
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() => {
            const pairs = [
              ...q.pairs,
              {
                id: crypto.randomUUID(),
                left: "",
                right: q.type === "statements" ? "True" : "",
                marks: 1,
              },
            ];
            change({
              pairs,
              ...(q.type === "multipart"
                ? { marks: pairs.reduce((s, p) => s + (p.marks ?? 1), 0) }
                : {}),
            });
          }}
        >
          + Add {q.type === "multipart" ? "part" : "item"}
        </button>
      </div>
    );
  return null;
}
export function SpecialResponse({
  q,
  value,
  change,
}: {
  q: PublicQuestion;
  value: ResponseValue | undefined;
  change: (v: ResponseValue) => void;
}) {
  const values =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [error, setError] = useState("");
  if (q.type === "diagram")
    return (
      <div>
        <label>
          Describe your answer
          <textarea
            rows={4}
            value={values.text || ""}
            onChange={(e) => change({ ...values, text: e.target.value })}
          />
        </label>
        <label>
          Attach a completed diagram
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 300000) {
                setError("Choose an image smaller than 300 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () =>
                change({ ...values, image: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {values.image && (
          <img
            className="student-image"
            src={values.image}
            alt="Your submitted diagram"
          />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    );
  if (q.type === "table")
    return (
      <div className="table-wrap">
        <table className="student-table">
          <tbody>
            {q.table.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={c.id}>
                    {c.blank ? (
                      <input
                        aria-label={`Row ${i + 1} column ${j + 1}`}
                        value={values[c.id] || ""}
                        onChange={(e) =>
                          change({ ...values, [c.id]: e.target.value })
                        }
                      />
                    ) : (
                      c.text
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (
    q.type === "list" ||
    q.type === "listprompt" ||
    q.type === "multipart" ||
    q.type === "statements"
  )
    return (
      <div>
        {q.pairs.map((p, i) => (
          <label key={p.id}>
            {q.type === "list" ? (
              `Item ${i + 1}`
            ) : (
              <>
                {p.left}{" "}
                {q.type === "multipart" && <small>{p.marks ?? 1} marks</small>}
              </>
            )}
            {q.type === "statements" ? (
              <select
                value={values[p.id] || ""}
                onChange={(e) => change({ ...values, [p.id]: e.target.value })}
              >
                <option value="">Choose…</option>
                <option>True</option>
                <option>False</option>
              </select>
            ) : q.type === "multipart" ? (
              <textarea
                rows={3}
                value={values[p.id] || ""}
                onChange={(e) => change({ ...values, [p.id]: e.target.value })}
              />
            ) : (
              <input
                value={values[p.id] || ""}
                onChange={(e) => change({ ...values, [p.id]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
    );
  return null;
}
export function SpecialPrint({
  q,
  answer = false,
}: {
  q: Question;
  answer?: boolean;
}) {
  if (q.type === "table")
    return (
      <table className="student-table">
        <tbody>
          {q.table.map((row, i) => (
            <tr key={i}>
              {row.map((c) => (
                <td key={c.id}>
                  {c.blank && !answer ? "________________" : c.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (["list", "listprompt", "multipart", "statements"].includes(q.type))
    return (
      <div>
        {q.pairs.map((p, i) => (
          <div className="print-part" key={p.id}>
            {q.type === "list" ? (
              `${i + 1}. ${answer ? p.left : "________________________"}`
            ) : (
              <>
                {i + 1}. {p.left}
                {q.type === "multipart" && (
                  <small> ({p.marks ?? 1} marks)</small>
                )}
                <p>
                  {answer
                    ? p.right
                    : q.type === "statements"
                      ? "True / False"
                      : "____________________________________"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    );
  return null;
}
