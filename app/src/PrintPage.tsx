import { Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { api, download, send } from "./api";
import { Brand, Button, ErrorBox, answerText } from "./common";
import {
  errorsFor,
  questionNumbers,
  typeLabels,
  type Question,
} from "./domain";
import { QuestionText } from "./RichDisplay";
import { SpecialPrint } from "./SpecialQuestions";
import type { Test } from "./types";

export function PrintPage({ id }: { id: string }) {
  const [doc, setDoc] = useState<(Test & { version: string }) | null>(null),
    [mode, setMode] = useState<"test" | "key" | "sheet">("test"),
    [error, setError] = useState("");
  useEffect(() => {
    const version = new URLSearchParams(location.search).get("v");
    api<Test & { version: string }>(
      version ? `/tests/${id}/print/${version}` : `/tests/${id}/print`,
      version ? {} : send("POST"),
    )
      .then((d) => {
        setDoc(d);
        if (!version)
          window.history.replaceState(null, "", `/print/${id}?v=${d.version}`);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  function zipgrade() {
    if (!doc) return;
    const invalid = doc.questions.findIndex(
      (q) =>
        !["multiple", "truefalse", "checklist"].includes(q.type) ||
        q.choices.length > 5 ||
        !q.choices.some((c) => c.correct) ||
        errorsFor(q).length,
    );
    if (invalid >= 0 || doc.questions.length > 100) {
      setError(
        "ZipGrade standard forms require up to 100 complete multiple-choice questions with at most five choices. This test contains an unsupported item.",
      );
      return;
    }
    const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const rows = doc.questions.map((q, i) => [
      "",
      String(i + 1),
      q.choices
        .map((c, j) => (c.correct ? String.fromCharCode(65 + j) : ""))
        .join(""),
      String(q.marks),
      q.category,
    ]);
    download(
      `zipgrade-key-${doc.version}.csv`,
      [
        ["Key", "Question Number", "Response/Mapping", "Point Value", "Tags"],
        ...rows,
      ]
        .map((r) => r.map(quote).join(","))
        .join("\n"),
      "text/csv",
    );
  }
  return (
    <div className="print-page">
      <div className="print-controls">
        <Brand />
        <div className="actions">
          <select
            aria-label="Document type"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="test">Student test</option>
            <option value="key">Answer key</option>
            <option value="sheet">Answer sheet</option>
          </select>
          <Button secondary onClick={zipgrade}>
            <Download size={16} />
            ZipGrade key CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={17} />
            Print / Save as PDF
          </Button>
        </div>
        <p>
          Use your browser’s “Save as PDF”. Disable browser headers and footers.
          Print the key before closing this tab to keep this version’s order.
        </p>
      </div>
      <div className="print-note">
        ZipGrade: use{" "}
        <a
          href="https://www.zipgrade.com/forms/"
          target="_blank"
          rel="noreferrer"
        >
          official standard answer sheets
        </a>
        . The CSV contains this print version’s primary key (ABCDE, up to 100
        questions). Importing a key file replaces existing ZipGrade key
        versions. Real scanning has not been validated here.
      </div>
      <ErrorBox error={error} />
      {doc && (
        <>
          <style>{`@page {size: ${doc.settings.paper};margin:16mm;} @media print {.printed-paper{width:auto!important;min-height:0!important;}}`}</style>
          <article
            className="printed-paper"
            style={{ width: doc.settings.paper === "A4" ? "210mm" : "216mm" }}
          >
            {doc.settings.backgroundImage && (
              <img
                className="print-background"
                src={doc.settings.backgroundImage}
                alt=""
              />
            )}
            {doc.settings.watermark && (
              <div className="watermark">{doc.settings.watermark}</div>
            )}
            <header>
              <span className="print-kicker">
                {mode === "key"
                  ? "TEACHER ANSWER KEY"
                  : mode === "sheet"
                    ? "STUDENT ANSWER SHEET"
                    : "CLASSROOM ASSESSMENT"}{" "}
                · VERSION {doc.version}
              </span>
              <h1>{doc.title}</h1>
              <p>{doc.settings.header}</p>
              {doc.description && <p>{doc.description}</p>}
            </header>
            <div
              className={`print-questions columns-${doc.settings.columns} ${doc.settings.verticalMarks ? "vertical-marks" : ""}`}
            >
              {doc.questions.map((q, i) => (
                <section
                  key={q.id}
                  className="print-question"
                  style={{
                    marginBottom: doc.settings.questionSpacing ?? 22,
                    breakBefore: q.pageBreak ? "page" : "auto",
                    breakInside: q.keepTogether === false ? "auto" : "avoid",
                  }}
                >
                  <div className="print-q-line">
                    <strong>
                      {
                        questionNumbers(doc.questions, doc.settings.subNumber)[
                          i
                        ]
                      }
                      .
                    </strong>
                    <div>
                      <div>
                        {mode === "sheet" ? (
                          typeLabels[q.type]
                        ) : (
                          <QuestionText
                            q={q}
                            slot={
                              q.type === "selection" && mode === "test" ? (
                                <span className="printed-inline-choice">
                                  [
                                  {q.choices
                                    .map(
                                      (c, i) =>
                                        `${String.fromCharCode(65 + i)}. ${c.text}`,
                                    )
                                    .join(" / ")}
                                  ]
                                </span>
                              ) : undefined
                            }
                          />
                        )}
                      </div>
                      {doc.settings.showMarks && (
                        <small>({q.marks} marks)</small>
                      )}
                    </div>
                  </div>
                  {mode !== "sheet" && q.image && (
                    <img
                      src={q.image}
                      alt={q.imageAlt || "Question illustration"}
                    />
                  )}
                  {[
                    "table",
                    "list",
                    "listprompt",
                    "multipart",
                    "statements",
                  ].includes(q.type) ? (
                    <SpecialPrint q={q} answer={mode === "key"} />
                  ) : mode === "key" ? (
                    <div className="printed-answer">
                      <strong>Answer:</strong>{" "}
                      {printKey(q) || "Teacher grading"}
                      {q.notes && <p>Notes: {q.notes}</p>}
                    </div>
                  ) : [
                      "multiple",
                      "truefalse",
                      "selection",
                      "checklist",
                    ].includes(q.type) &&
                    !(q.type === "selection" && mode === "test") ? (
                    q.choices.map((c, j) => (
                      <div className="printed-choice" key={c.id}>
                        <span>{q.type === "checklist" ? "□" : "○"}</span>
                        <strong>{String.fromCharCode(65 + j)}.</strong>
                        {mode === "sheet" ? "" : c.text}
                      </div>
                    ))
                  ) : q.type === "matching" || q.type === "multimatch" ? (
                    <div className="print-matches">
                      <div>
                        {q.pairs.map((p, j) => (
                          <p key={p.id}>
                            {j + 1}. {mode === "sheet" ? "" : p.left} _____
                          </p>
                        ))}
                      </div>
                      <div>
                        {[
                          ...new Set(
                            [
                              ...(q.matchOptions || []),
                              ...q.pairs.map((p) => p.right),
                            ].filter((x) => x.trim()),
                          ),
                        ]
                          .sort()
                          .map((x, j) => (
                            <p key={j}>
                              {String.fromCharCode(65 + j)}.{" "}
                              {mode === "sheet" ? "" : x}
                            </p>
                          ))}
                      </div>
                    </div>
                  ) : q.type === "ordering" ? (
                    q.pairs
                      .slice()
                      .sort((a, b) => a.left.localeCompare(b.left))
                      .map((p) => (
                        <p key={p.id}>____ {mode === "sheet" ? "" : p.left}</p>
                      ))
                  ) : (
                    <div className="answer-lines">
                      {Array.from(
                        {
                          length:
                            q.type === "essay" ? 5 : q.type === "short" ? 2 : 1,
                        },
                        (_, j) => (
                          <div key={j} />
                        ),
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>
            <footer>
              {doc.settings.footer}
              <span>
                {doc.version} · {doc.questions.reduce((s, q) => s + q.marks, 0)}{" "}
                marks
              </span>
            </footer>
          </article>
        </>
      )}
    </div>
  );
}

function printKey(q: Question) {
  if (["multiple", "truefalse", "selection", "checklist"].includes(q.type))
    return q.choices
      .map((c, i) =>
        c.correct ? `${String.fromCharCode(65 + i)}. ${c.text}` : "",
      )
      .filter(Boolean)
      .join("; ");
  if (["matching", "multimatch"].includes(q.type)) {
    const options = [
      ...new Set(
        [...(q.matchOptions || []), ...q.pairs.map((p) => p.right)].filter(
          (x) => x.trim(),
        ),
      ),
    ].sort();
    return q.pairs
      .map(
        (p, i) =>
          `${i + 1}. ${p.left} → ${String.fromCharCode(65 + options.indexOf(p.right))}. ${p.right}`,
      )
      .join("; ");
  }
  return answerText(q);
}
