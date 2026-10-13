import { ArrowRight, Check, Clock, FileText, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, send } from "./api";
import { Brand, Button, ErrorBox, Modal } from "./common";
import { type PublicQuestion, type ResponseValue } from "./domain";
import { ResponseInput, InlineChoice } from "./QuestionViews";
import { QuestionText } from "./RichDisplay";
import type { AttemptView } from "./types";

export function Student({ code }: { code: string }) {
  const [info, setInfo] = useState<{
      title: string;
      description: string;
      count: number;
      timeLimit: number;
      accessCode: boolean;
    } | null>(null),
    [attempt, setAttempt] = useState<AttemptView | null>(null),
    [credentials, setCredentials] = useState<{
      id: string;
      token: string;
    } | null>(null),
    [name, setName] = useState(""),
    [studentId, setStudentId] = useState(""),
    [accessCode, setAccessCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [responses, setResponses] = useState<Record<string, ResponseValue>>({}),
    [saveStatus, setSaveStatus] = useState("All answers saved"),
    [confirmSubmit, setConfirmSubmit] = useState(false),
    [now, setNow] = useState(Date.now());
  const latest = useRef<Record<string, ResponseValue>>({}),
    saved = useRef(""),
    saving = useRef(false),
    offset = useRef(0);
  const headers: Record<string, string> = credentials
    ? { "X-Attempt-Token": credentials.token }
    : {};
  async function load(c: { id: string; token: string }) {
    const a = await api<AttemptView>(`/attempts/${c.id}`, {
      headers: { "X-Attempt-Token": c.token },
    });
    offset.current = a.serverNow - Date.now();
    setAttempt(a);
    setCredentials(c);
    const cached = localStorage.getItem(`classpaper:pending:${c.id}`);
    let values = a.responses;
    if (a.status === "active" && cached) {
      try {
        values = { ...a.responses, ...JSON.parse(cached) };
      } catch {}
    }
    setResponses(values);
    latest.current = values;
    saved.current = JSON.stringify(a.responses);
    if (JSON.stringify(values) !== saved.current)
      setSaveStatus("Waiting to save your answers");
    if (a.status === "submitted")
      localStorage.removeItem(`classpaper:pending:${c.id}`);
  }
  useEffect(() => {
    const c = localStorage.getItem(`classpaper:attempt:${code}`);
    api<typeof info>(`/join/${code}`)
      .then(setInfo)
      .catch((e) => {
        if (!c) setError(e.message);
      });
    if (c) {
      try {
        load(JSON.parse(c)).catch((e) => setError(e.message));
      } catch {
        localStorage.removeItem(`classpaper:attempt:${code}`);
      }
    }
  }, [code]);
  async function save(): Promise<boolean> {
    if (
      !credentials ||
      !attempt ||
      attempt.status !== "active" ||
      saving.current
    )
      return false;
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === saved.current) return true;
    saving.current = true;
    setSaveStatus("Saving answers…");
    try {
      await api(`/attempts/${credentials.id}/answers`, {
        ...send("PUT", { responses: latest.current }),
        headers,
      });
      saved.current = snapshot;
      if (JSON.stringify(latest.current) === snapshot) {
        localStorage.removeItem(`classpaper:pending:${credentials.id}`);
        setSaveStatus("All answers saved");
      } else setSaveStatus("Waiting to save your answers");
      setError("");
      return true;
    } catch (e) {
      setSaveStatus("Not saved yet · retrying");
      setError((e as Error).message);
      if ((e as Error).message.includes("ended")) await load(credentials);
      return false;
    } finally {
      saving.current = false;
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const timer = setInterval(() => {
      saveRef.current();
      setNow(Date.now() + offset.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      attempt?.status === "active" &&
      attempt.deadline &&
      now >= Number(attempt.deadline) &&
      credentials
    )
      load(credentials).catch((e) => setError(e.message));
  }, [now, attempt?.status, attempt?.deadline]);
  function change(id: string, v: ResponseValue) {
    const next = { ...latest.current, [id]: v };
    latest.current = next;
    setResponses(next);
    setSaveStatus("Waiting to save your answers");
    if (credentials)
      localStorage.setItem(
        `classpaper:pending:${credentials.id}`,
        JSON.stringify(next),
      );
  }
  async function submit() {
    if (!credentials) return;
    setBusy(true);
    try {
      for (let i = 0; i < 40 && saving.current; i++)
        await new Promise((r) => setTimeout(r, 100));
      if (!(await saveRef.current()))
        throw new Error(
          "Your answers must finish saving before you submit. Please try again.",
        );
      await api(`/attempts/${credentials.id}/submit`, {
        ...send("POST"),
        headers,
      });
      await load(credentials);
      setConfirmSubmit(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const answered =
    attempt?.questions.filter((q) => hasAnswer(responses[q.id], q)).length || 0;
  const remaining = attempt?.deadline
    ? Math.max(0, Math.ceil((Number(attempt.deadline) - now) / 1000))
    : null;
  return (
    <div className="student-page">
      <header className="student-top">
        <Brand />
        <span>A little focus. A little confidence.</span>
      </header>
      <div className="student-container">
        <ErrorBox error={error} />
        {attempt?.status === "submitted" ? (
          <div className="submitted-card">
            <div className="submitted-check">
              <Check size={35} />
            </div>
            <div className="eyebrow">ALL DONE</div>
            <h1>Your test is submitted.</h1>
            <p>Thanks, {attempt.name}. Your teacher has your responses.</p>
            {attempt.result?.score !== null && attempt.result && (
              <div className="score">
                <strong>{attempt.result.score}</strong>
                <span>/ {attempt.result.possible} marks</span>
              </div>
            )}
            {attempt.result?.pending && (
              <p className="notice">
                Some answers still need teacher grading. Your score may change.
              </p>
            )}
            {attempt.result?.answers?.map((a, i) => (
              <div className="answer-review" key={a.id}>
                <strong>Question {i + 1}</strong>
                <p>Answer: {a.answer || "Teacher grading"}</p>
                <small>
                  {a.grade.manual
                    ? "Awaiting teacher grading"
                    : `${a.grade.earned} / ${a.grade.possible} marks`}
                </small>
                {a.feedback && <p>Teacher feedback: {a.feedback}</p>}
              </div>
            ))}
          </div>
        ) : attempt ? (
          <>
            <div className="student-title">
              <div className="eyebrow">
                YOU’VE GOT THIS, {attempt.name.toUpperCase()}
              </div>
              <h1>{attempt.title}</h1>
              <div className="student-progress-row">
                <span>
                  {answered} of {attempt.questions.length} answered
                </span>
                {remaining !== null && (
                  <span className={remaining < 60 ? "danger-text" : ""}>
                    <Clock size={16} />
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")} remaining
                  </span>
                )}
              </div>
              <div className="progress">
                <div
                  style={{
                    width: `${(answered / attempt.questions.length) * 100}%`,
                  }}
                />
              </div>
              <small
                className={
                  saveStatus === "All answers saved" ? "green" : "muted"
                }
                aria-live="polite"
              >
                {saveStatus}
              </small>
            </div>
            {attempt.questions.map((q, i) => (
              <section className="student-question" key={q.id}>
                <div className="student-q-head">
                  <span className="question-number">{i + 1}</span>
                  <span className="muted">{q.marks} marks</span>
                </div>
                <div className="question-body">
                  <QuestionText
                    q={q}
                    slot={
                      q.type === "selection" ? (
                        <InlineChoice
                          q={q}
                          value={responses[q.id]}
                          change={(v) => change(q.id, v)}
                        />
                      ) : undefined
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
                <ResponseInput
                  q={q}
                  value={responses[q.id]}
                  change={(v) => change(q.id, v)}
                />
              </section>
            ))}
            <div className="student-submit">
              <span>
                <Lock size={15} />
                Your answers are shared with your teacher.
              </span>
              <Button onClick={() => setConfirmSubmit(true)}>
                Review & submit
                <ArrowRight size={17} />
              </Button>
            </div>
          </>
        ) : info ? (
          <div className="join-card">
            <div className="eyebrow">WELCOME TO YOUR TEST</div>
            <h1>{info.title}</h1>
            <p>
              {info.description ||
                "Read each question carefully. Take your time, and do your best."}
            </p>
            <div className="share-summary">
              <span>
                <FileText size={17} />
                {info.count} questions
              </span>
              <span>
                <Clock size={17} />
                {info.timeLimit ? `${info.timeLimit} minutes` : "No time limit"}
              </span>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const c = await api<{ id: string; token: string }>(
                    `/join/${code}`,
                    send("POST", { name, studentId, accessCode }),
                  );
                  localStorage.setItem(
                    `classpaper:attempt:${code}`,
                    JSON.stringify(c),
                  );
                  await load(c);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Your name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Student ID
                <input
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Use the ID your teacher gave you"
                />
              </label>
              {info.accessCode && (
                <label>
                  Test access code
                  <input
                    required
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </label>
              )}
              <Button disabled={busy}>
                {busy ? "Opening your test…" : "Start test"}
                <ArrowRight size={17} />
              </Button>
              <p className="fine-print">
                Keep this browser open. Your answers save as you go.
              </p>
            </form>
          </div>
        ) : !error ? (
          <p>Opening your test…</p>
        ) : null}
      </div>
      {confirmSubmit && (
        <Modal
          title="Ready to hand it in?"
          onClose={() => setConfirmSubmit(false)}
        >
          <p>
            {answered === attempt?.questions.length
              ? "You have answered every question."
              : `You have ${attempt!.questions.length - answered} unanswered question(s). You can go back and finish them.`}
          </p>
          <p className="muted">
            Once submitted, your answers cannot be changed.
          </p>
          <ErrorBox error={error} />
          <div className="modal-actions">
            <Button secondary onClick={() => setConfirmSubmit(false)}>
              Keep working
            </Button>
            <Button disabled={busy} onClick={submit}>
              {busy ? "Submitting…" : "Submit my test"}
              <Check size={17} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function hasAnswer(v: ResponseValue | undefined, q?: PublicQuestion) {
  if (q && typeof v === "object" && !Array.isArray(v) && v) {
    if (q.type === "diagram") return !!(v.text?.trim() || v.image);
    const expected =
      q.type === "table"
        ? q.table
            .flat()
            .filter((c) => c.blank)
            .map((c) => c.id)
        : q.pairs.map((p) => p.id);
    if (expected.length) return expected.every((id) => !!v[id]?.trim());
  }
  return typeof v === "string"
    ? !!v.trim()
    : Array.isArray(v)
      ? v.length > 0 && v.every((x) => x.trim())
      : v &&
        Object.values(v).length > 0 &&
        Object.values(v).every((x) => x.trim());
}
