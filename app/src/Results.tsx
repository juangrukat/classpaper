import { ChevronRight, Copy, Download, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, download, send } from "./api";
import { Button, Empty, ErrorBox, Modal, answerText } from "./common";
import { type Question } from "./domain";
import { QuestionText } from "./RichDisplay";
import type { ResultAttempt, ResultSet } from "./types";

export function Results() {
  const [publications, setPublications] = useState<
      {
        code: string;
        test_id: string;
        title: string;
        attempts: number;
        open: boolean;
        created_at: string;
      }[]
    >([]),
    [selected, setSelected] = useState(""),
    [data, setData] = useState<ResultSet | null>(null),
    [review, setReview] = useState<ResultAttempt | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const load = () =>
    api<typeof publications>("/results")
      .then(setPublications)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const detail = async (code: string) => {
    setSelected(code);
    setData(await api<ResultSet>(`/results/${code}`));
  };
  function csv() {
    if (!data) return;
    const safe = (x: string) =>
      '"' + (/^[=+@\-\t\r]/.test(x) ? "'" + x : x).replace(/"/g, '""') + '"';
    download(
      "results.csv",
      [
        [
          "Name",
          "Student ID",
          "Status",
          "Score",
          "Possible",
          "Awaiting teacher grading",
        ],
        ...data.attempts.map((a) => [
          a.name,
          a.student_id,
          a.status,
          String(total(a)),
          String(a.questions.reduce((s, q) => s + q.marks, 0)),
          String(
            a.questions.some(
              (q) => a.grades[q.id]?.manual && !a.overrides[q.id],
            ),
          ),
        ]),
      ]
        .map((row) => row.map(safe).join(","))
        .join("\n"),
      "text/csv",
    );
  }
  return (
    <>
      <header className="topbar">See what your students know.</header>
      <div className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">FROM ANSWERS TO UNDERSTANDING</div>
            <h1>
              Results<span className="serif">.</span>
            </h1>
            <p className="muted">
              Review responses, add feedback, and finish teacher grading.
            </p>
          </div>
          {data && (
            <Button secondary onClick={csv}>
              <Download size={17} />
              Export results
            </Button>
          )}
        </div>
        <ErrorBox error={error} />
        {!publications.length ? (
          <Empty
            title="Their next step starts here."
            body="Share a test online. Student responses will appear in this workspace."
          />
        ) : (
          <div className="results-layout">
            <aside className="results-tests">
              {publications.map((p) => (
                <button
                  key={p.code}
                  className={selected === p.code ? "selected" : ""}
                  onClick={() =>
                    detail(p.code).catch((e) => setError(e.message))
                  }
                >
                  <strong>{p.title}</strong>
                  <small>
                    {p.attempts} attempts ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                  </small>
                  <span className="badge">
                    {p.open ? "Accepting responses" : "Closed"}
                  </span>
                </button>
              ))}
            </aside>
            <section className="results-detail">
              {!data ? (
                <Empty
                  title="Choose a shared test."
                  body="See scores and individual student answers."
                />
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>{data.title}</h2>
                      <p className="muted">
                        {data.attempts.length} student attempts
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        detail(selected).catch((e) => setError(e.message))
                      }
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="actions result-actions">
                    <Button
                      secondary
                      onClick={() =>
                        navigator.clipboard
                          .writeText(`${location.origin}/take/${selected}`)
                          .then(() => setCopied(true))
                      }
                    >
                      <Copy size={15} />
                      {copied ? "Copied" : "Copy student link"}
                    </Button>
                    {publications.find((p) => p.code === selected)?.open && (
                      <Button
                        secondary
                        onClick={async () => {
                          if (
                            confirm(
                              "Close all shared links for this test? Existing attempts can still finish.",
                            )
                          ) {
                            await api(
                              `/tests/${publications.find((p) => p.code === selected)!.test_id}`,
                              send("DELETE"),
                            );
                            load();
                          }
                        }}
                      >
                        Close test links
                      </Button>
                    )}
                  </div>
                  {!data.attempts.length ? (
                    <p className="muted">
                      Waiting for your first student. Share the link to get
                      started.
                    </p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {data.attempts.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <strong>{a.name}</strong>
                                <small>{a.student_id}</small>
                              </td>
                              <td>
                                <span className="badge">
                                  {a.status === "active"
                                    ? "In progress"
                                    : a.questions.some(
                                          (q) =>
                                            a.grades[q.id]?.manual &&
                                            !a.overrides[q.id],
                                        )
                                      ? "Needs grading"
                                      : "Submitted"}
                                </span>
                              </td>
                              <td>
                                {a.status === "active"
                                  ? "—"
                                  : `${total(a)} / ${a.questions.reduce((s, q) => s + q.marks, 0)}`}
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => setReview(a)}
                                >
                                  Review
                                  <ChevronRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
      {review && (
        <Modal
          title={`${review.name} · ${review.student_id}`}
          wide
          onClose={() => setReview(null)}
        >
          {review.questions.map((q, i) => (
            <GradeReview
              key={q.id}
              q={q}
              number={i + 1}
              attempt={review}
              code={selected}
              onSave={async () => {
                const d = await api<ResultSet>(`/results/${selected}`);
                setData(d);
                setReview(d.attempts.find((a) => a.id === review.id) || null);
              }}
            />
          ))}
        </Modal>
      )}
    </>
  );
}

export function GradeReview({
  q,
  number,
  attempt: a,
  code,
  onSave,
}: {
  q: Question;
  number: number;
  attempt: ResultAttempt;
  code: string;
  onSave: () => Promise<void>;
}) {
  const [earned, setEarned] = useState(
      a.overrides[q.id]?.earned ?? a.grades[q.id]?.earned ?? 0,
    ),
    [feedback, setFeedback] = useState(a.overrides[q.id]?.feedback || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const raw = a.responses[q.id];
  let response = "No answer";
  if (typeof raw === "string")
    response = q.choices.find((c) => c.id === raw)?.text || raw;
  else if (Array.isArray(raw))
    response = raw
      .map(
        (v) =>
          q.choices.find((c) => c.id === v)?.text ||
          q.pairs.find((p) => p.id === v)?.left ||
          v,
      )
      .join(", ");
  else if (raw && q.type === "diagram")
    response = raw.text || "Diagram attached";
  else if (raw && q.type === "table")
    response = q.table
      .flat()
      .filter((c) => c.blank)
      .map((c) => raw[c.id] || "No answer")
      .join("; ");
  else if (raw)
    response = q.pairs
      .map((p) => `${p.left} → ${raw[p.id] || "No answer"}`)
      .join("; ");
  return (
    <section className="grade-review">
      <div className="student-q-head">
        <strong>Question {number}</strong>
        <span>{q.marks} marks</span>
      </div>
      <div className="question-body">
        <QuestionText q={q} />
      </div>
      <div className="response-box">
        <small>STUDENT ANSWER</small>
        <p>{response}</p>
        {q.type === "diagram" &&
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          raw.image &&
          /^data:image\/(png|jpeg|webp);base64,/.test(raw.image) && (
            <img
              className="student-image"
              src={raw.image}
              alt="Student diagram response"
            />
          )}
      </div>
      <p className="answer-preview">
        Answer guide: {answerText(q) || "Teacher judgment"}
      </p>
      {a.status === "submitted" && (
        <>
          <div className="form-grid">
            <label>
              Marks earned
              <input
                type="number"
                min={0}
                max={q.marks}
                step="any"
                value={earned}
                onChange={(e) => setEarned(Number(e.target.value))}
              />
            </label>
            <label>
              Feedback
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
          </div>
          <ErrorBox error={error} />
          <Button
            secondary
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(
                  `/results/${code}/${a.id}/grade`,
                  send("PUT", { questionId: q.id, earned, feedback }),
                );
                await onSave();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={15} />
            {busy ? "Saving…" : "Save grade"}
          </Button>
        </>
      )}
    </section>
  );
}

export function total(a: ResultAttempt) {
  return a.questions.reduce(
    (s, q) => s + (a.overrides[q.id]?.earned ?? a.grades[q.id]?.earned ?? 0),
    0,
  );
}
