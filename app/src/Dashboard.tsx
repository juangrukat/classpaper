import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, send } from "./api";
import { Button, Empty, ErrorBox, Modal, answerText } from "./common";
import { defaults, typeLabels, type Question } from "./domain";
import type { Report, Test, TestSummary, User } from "./types";

export function Dashboard({
  user,
  open,
}: {
  user: User;
  open: (id: string) => void;
}) {
  const [tests, setTests] = useState<TestSummary[]>([]),
    [search, setSearch] = useState(""),
    [showNew, setShowNew] = useState(false),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [showSources, setShowSources] = useState(false);
  const load = () =>
    api<TestSummary[]>("/tests")
      .then(setTests)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function create(
    questions: Question[] = [],
    name = title,
    document?: Report["document"],
  ) {
    try {
      const t = await api<Test>(
        "/tests",
        send("POST", {
          title: name || "Untitled test",
          description: document?.description || "",
          questions,
          settings: document?.settings || defaults,
        }),
      );
      open(t.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <header className="topbar">
        <span>Your teaching, a little simpler.</span>
        <div className="topbar-right">
          <span className="status-dot" />
          Your private workspace
        </div>
      </header>
      <div className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">READY WHEN YOU ARE</div>
            <h1>
              Hello, {user.name.split(" ")[0]}
              <span className="serif">.</span>
            </h1>
            <p className="muted">
              Good questions. Confident students. A little less admin.
            </p>
          </div>
          <Button
            onClick={() => {
              setTitle("");
              setShowNew(true);
            }}
          >
            <Plus size={18} />
            Create a test
          </Button>
        </div>
        <section className="welcome-banner">
          <div>
            <span className="tiny-label">
              FROM FIRST QUESTION TO FINAL ANSWER
            </span>
            <h2>One test. Two ways to teach.</h2>
            <p>
              Build it once. Print a classroom set or share a link
              <br className="desktop" /> and let your students take it online.
            </p>
            <button className="banner-link" onClick={() => setImporting(true)}>
              Already have questions? Import them <ArrowRight size={17} />
            </button>
          </div>
          <div className="banner-illustration" aria-hidden="true">
            <div className="mini-paper">
              <div className="mini-title" />
              <div className="mini-line" />
              <div className="mini-line short" />
              {[0, 1, 2].map((i) => (
                <div className="mini-choice" key={i}>
                  <span className={i === 1 ? "filled" : ""} />
                  <div />
                </div>
              ))}
              <div className="mini-stamp">
                <Check size={24} />
              </div>
            </div>
            <div className="mini-phone">
              <span />
              <div className="phone-line" />
              <div className="phone-line" />
              <div className="phone-button">
                <Check size={18} />
              </div>
            </div>
            <span className="spark spark-one">✧</span>
            <span className="spark spark-two">✧</span>
          </div>
        </section>
        <div className="section-heading">
          <div>
            <h2>
              My tests <span className="count">{tests.length}</span>
            </h2>
            <p className="muted">Pick up where you left off.</p>
          </div>
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search tests"
              placeholder="Find a test…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <ErrorBox error={error} />
        {tests.length === 0 ? (
          <Empty
            title="Your first test is a fresh start."
            body="Create a test from scratch, or bring in questions you already have."
          >
            <div className="actions">
              <Button onClick={() => setShowNew(true)}>
                <Plus size={17} />
                Create a test
              </Button>
              <Button secondary onClick={() => setImporting(true)}>
                <Upload size={17} />
                Import questions
              </Button>
            </div>
          </Empty>
        ) : (
          <div className="test-grid">
            {tests
              .filter((t) =>
                t.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((t, i) => (
                <button
                  className="test-card"
                  key={t.id}
                  onClick={() => open(t.id)}
                >
                  <div className="card-top">
                    <div className={`subject-icon tone-${i % 3}`}>
                      <FileText size={23} />
                    </div>
                    <span className={`badge ${t.published ? "live" : ""}`}>
                      {t.published ? "Shared online" : "Draft"}
                    </span>
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.description || "Ready for your next lesson."}</p>
                  <div className="card-bottom">
                    <span>
                      {t.count} question{t.count === 1 ? "" : "s"}
                    </span>
                    <span>
                      Open test <ArrowRight size={15} />
                    </span>
                  </div>
                </button>
              ))}
            {!tests.some((t) =>
              t.title.toLowerCase().includes(search.toLowerCase()),
            ) && <p>No tests match “{search}”.</p>}
          </div>
        )}
        <div className="help-strip">
          <BookOpen size={19} />
          <span>
            Your questions stay yours. Export a complete package whenever you
            need it.
          </span>
          <button className="text-button" onClick={() => setImporting(true)}>
            Import guide <ArrowRight size={14} />
          </button>
        </div>
      </div>
      {showNew && (
        <Modal title="Let’s make a test" onClose={() => setShowNew(false)}>
          <p className="muted">
            Start with a title. You can change it any time.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label>
              Test title
              <input
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 3 · The solar system"
              />
            </label>
            <div className="modal-actions">
              <Button
                secondary
                type="button"
                onClick={() => {
                  setShowNew(false);
                  setImporting(true);
                }}
              >
                <Upload size={16} />
                Import instead
              </Button>
              <Button>
                Create test
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        </Modal>
      )}
      <button className="text-button" onClick={() => setShowSources(true)}>
        Original import files
      </button>
      {showSources && <SourceArchive onClose={() => setShowSources(false)} />}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImport={(qs, name, document) =>
            create(qs, name || "Imported test", document)
          }
        />
      )}
    </>
  );
}

export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (
    qs: Question[],
    name?: string,
    document?: Report["document"],
  ) => void;
}) {
  const [report, setReport] = useState<Report | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false);
  const [raw, setRaw] = useState(""),
    [hasHeaders, setHasHeaders] = useState(true),
    [mapping, setMapping] = useState<Record<string, number>>({});
  const columnLabels: Record<string, string> = {
    question: "Question text",
    choice_a: "Choice A",
    choice_b: "Choice B",
    choice_c: "Choice C (optional)",
    choice_d: "Choice D (optional)",
    answer: "Correct answer or answer guide",
    type: "Question type (optional)",
    marks: "Marks (optional)",
    category: "Category (optional)",
  };
  async function read(file: File) {
    setBusy(true);
    setError("");
    setReport(null);
    setAck(false);
    setName(file.name);
    try {
      if (file.size > 15_000_000)
        throw new Error("Please choose a file smaller than 15 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      const data = btoa(binary);
      setRaw(data);
      setHasHeaders(true);
      const result = await api<Report>(
        "/import",
        send("POST", { name: file.name, data }),
      );
      setReport(result);
      if (result.csv)
        setMapping(
          Object.fromEntries(
            Object.keys(columnLabels).map((k) => [
              k,
              result.csv!.headers.findIndex(
                (h) => h.trim().toLowerCase() === k,
              ),
            ]),
          ),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Bring your questions with you" wide onClose={onClose}>
      <p className="muted">
        Choose a file. We’ll show you what’s inside before adding anything. The
        original is retained privately in your import archive.
      </p>
      <label className="dropzone">
        <Upload size={29} />
        <strong>
          {busy ? "Reading your questions…" : name || "Choose a question file"}
        </strong>
        <span>
          GIFT / Aiken · CSV / TSV · Classpaper / QTI ZIP · Schoolhouse 5 TST
        </span>
        <input
          type="file"
          accept=".gift,.aiken,.txt,.csv,.tsv,.zip,.json,.tst,.xml"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
        />
      </label>
      <div className="import-note">
        <FileText size={16} />
        <span>
          Using a spreadsheet?{" "}
          <a href="/api/template.csv" download="question-template.csv">
            Download our easy CSV template.
          </a>
        </span>
      </div>
      <ErrorBox error={error} />
      {report?.csv && (
        <div className="csv-mapping">
          <h3>Match your columns</h3>
          <p className="muted">
            Tell us which columns contain the question, choices and answer. Here
            are the first few rows of your file.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {report.csv.headers.map((h, i) => (
                    <th key={i}>{h || `Column ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.csv.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={hasHeaders}
              onChange={(e) => setHasHeaders(e.target.checked)}
            />
            The first row contains column headings
          </label>
          <div className="form-grid">
            {Object.entries(columnLabels).map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  value={mapping[key] ?? -1}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>Not used</option>
                  {report.csv!.headers.map((h, i) => (
                    <option value={i} key={i}>
                      {hasHeaders ? h || `Column ${i + 1}` : `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="hint">
            Correct choices use letters such as A or B. Without a type column,
            questions use multiple choice.
          </p>
          <Button
            disabled={busy || (mapping.question ?? -1) < 0}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setReport(
                  await api<Report>(
                    "/import",
                    send("POST", {
                      name,
                      data: raw,
                      csv: { hasHeaders, mapping },
                    }),
                  ),
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Preview my questions
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      {report && !report.csv && (
        <>
          <div className="review-summary">
            <CheckCircle2 size={22} />
            <div>
              <strong>
                {report.questions.length} questions ready to import
              </strong>
              <small>
                {report.errors.length
                  ? `${report.errors.length} issue(s) require attention.`
                  : "Your file has been checked."}
              </small>
            </div>
          </div>
          {!!report.errors.length && (
            <div className="notice danger">
              <strong>These items were not imported</strong>
              {report.errors.slice(0, 20).map((x, i) => (
                <p key={i}>{x}</p>
              ))}
            </div>
          )}
          {!!report.warnings.length && (
            <div className="notice">
              <strong>Please review before importing</strong>
              {[...new Set(report.warnings)].slice(0, 20).map((x, i) => (
                <p key={i}>{x}</p>
              ))}
            </div>
          )}
          <div className="import-preview">
            {report.questions.map((q, i) => (
              <div key={q.id}>
                <span className="question-number">{i + 1}</span>
                <div>
                  <small>{typeLabels[q.type]}</small>
                  <p>{q.text}</p>
                  {q.image && (
                    <img
                      className="preview-image"
                      src={q.image}
                      alt="Imported question"
                    />
                  )}
                  <small className="answer-preview">
                    Answer: {answerText(q) || "Teacher grading"}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {(!!report.errors.length || !!report.warnings.length) && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I’ve reviewed the issues. Add only the questions shown above.
            </label>
          )}
          <div className="modal-actions">
            <Button secondary onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={
                !report.questions.length ||
                ((!!report.errors.length || !!report.warnings.length) && !ack)
              }
              onClick={() =>
                onImport(report.questions, report.title, report.document)
              }
            >
              Import {report.questions.length} questions
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function SourceArchive({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<
      { id: string; name: string; created_at: string }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<typeof rows>("/import/sources")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="Original import files" onClose={onClose}>
      <p>
        Download an unchanged source when checking a migration. Only your
        workspace can access these files.
      </p>
      <ErrorBox error={error} />
      {!rows.length && <p>No retained files yet.</p>}
      {rows.map((r) => (
        <p key={r.id}>
          <a href={`/api/import/sources/${r.id}`}>{r.name}</a> ·{" "}
          {new Date(r.created_at).toLocaleDateString()}
        </p>
      ))}
    </Modal>
  );
}
