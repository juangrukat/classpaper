import { InlineEditor } from "./InlineEditor";
import { PictureEditor } from "./PictureEditor";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  FlipHorizontal,
  Image as ImageIcon,
  Library,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  Settings,
  Share2,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, download, send } from "./api";
import { BankPicker } from "./Bank";
import { Button, Empty, ErrorBox, Modal } from "./common";
import { ImportDialog } from "./Dashboard";
import {
  errorsFor,
  kinds,
  newQuestion,
  typeLabels,
  type Question,
  type Settings as TestSettings,
} from "./domain";
import { PreviewQuestion } from "./QuestionViews";
import { RichTextEditor } from "./RichText";
import { SpecialEditor, specialKinds } from "./SpecialQuestions";
import type { Test, User } from "./types";

export function Editor({
  id,
  onBack,
  user,
}: {
  id: string;
  onBack: () => void;
  user: User;
}) {
  const [doc, setDoc] = useState<Test | null>(null),
    [selected, setSelected] = useState(0),
    [saveStatus, setSaveStatus] = useState("Saved"),
    [error, setError] = useState(""),
    [modal, setModal] = useState<
      | "add"
      | "import"
      | "export"
      | "share"
      | "settings"
      | "bank"
      | "preview"
      | null
    >(null),
    [message, setMessage] = useState(""),
    [share, setShare] = useState("");
  const saved = useRef(""),
    current = useRef<Test | null>(null),
    saving = useRef(false),
    revision = useRef(1),
    blocked = useRef(false);
  useEffect(() => {
    api<Test>(`/tests/${id}`)
      .then((t) => {
        setDoc(t);
        current.current = t;
        revision.current = t.revision;
        saved.current = JSON.stringify(t);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const persist = useCallback(async () => {
    const d = current.current;
    if (!d || saving.current || blocked.current) return false;
    const snapshot = JSON.stringify(d);
    if (snapshot === saved.current) return true;
    saving.current = true;
    setSaveStatus("Saving…");
    try {
      const result = await api<{ revision: number }>(
        `/tests/${id}`,
        send("PUT", { ...d, revision: revision.current }),
      );
      revision.current = result.revision;
      saved.current = snapshot;
      setError("");
      setSaveStatus(
        current.current && JSON.stringify(current.current) !== snapshot
          ? "Unsaved changes"
          : "Saved",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("Not saved");
      if ((e as Error).message.includes("another tab")) blocked.current = true;
      return false;
    } finally {
      saving.current = false;
    }
  }, [id]);
  useEffect(() => {
    const timer = setInterval(() => {
      persist();
    }, 900);
    return () => clearInterval(timer);
  }, [persist]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (
        current.current &&
        JSON.stringify(current.current) !== saved.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  function update(p: Partial<Test>) {
    if (!doc) return;
    const next = { ...doc, ...p };
    setDoc(next);
    current.current = next;
    setSaveStatus("Unsaved changes");
    setMessage("");
  }
  function edit(q: Question) {
    if (!doc) return;
    update({
      questions: doc.questions.map((x, i) => (i === selected ? q : x)),
    });
  }
  async function ensureSaved() {
    for (let i = 0; i < 30; i++) {
      if (saving.current) await new Promise((r) => setTimeout(r, 100));
      else break;
    }
    if (!(await persist())) return false;
    return JSON.stringify(current.current) === saved.current;
  }
  if (!doc)
    return (
      <div className="page">
        <ErrorBox error={error} />
        <p>Opening your test…</p>
      </div>
    );
  const q = doc.questions[selected];
  const problems = doc.questions.flatMap((q, i) =>
    errorsFor(q).map((x) => ({ i, text: x })),
  );
  const duplicate = doc.questions
    .map((q, i) => ({ q, i }))
    .filter(
      ({ q, i }) =>
        q.text.trim() &&
        doc.questions.findIndex(
          (other) =>
            other.text.trim().toLowerCase() === q.text.trim().toLowerCase(),
        ) !== i,
    );
  return (
    <>
      <header className="editor-top">
        <button
          className="text-button"
          onClick={async () => {
            if (await ensureSaved()) onBack();
          }}
        >
          <ArrowLeft size={16} />
          My tests
        </button>
        <span
          className={`save-status ${saveStatus === "Saved" ? "saved" : ""}`}
        >
          <span className="status-dot" />
          {saveStatus}
        </span>
        <span className="editor-owner">{user.name}</span>
      </header>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">YOUR TEST, YOUR WAY</span>
          <input
            className="title-input"
            aria-label="Test title"
            value={doc.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <div className="editor-meta">
            {doc.questions.length} questions <span>·</span>{" "}
            {doc.questions.reduce((s, q) => s + q.marks, 0)} marks
          </div>
        </div>
        <div className="actions">
          <Button secondary onClick={() => setModal("preview")}>
            <Eye size={17} />
            Preview
          </Button>
          <Button
            secondary
            onClick={async () => {
              if (await ensureSaved()) window.open(`/print/${id}`, "_blank");
            }}
          >
            <Printer size={17} />
            Print
          </Button>
          <Button onClick={() => setModal("share")}>
            <Share2 size={17} />
            Share test
          </Button>
        </div>
      </div>
      <div className="editor-tools">
        <div>
          <button onClick={() => setModal("import")}>
            <Upload size={16} />
            Import
          </button>
          <button onClick={() => setModal("export")}>
            <Download size={16} />
            Export
          </button>
          <button onClick={() => setModal("bank")}>
            <Library size={16} />
            From question bank
          </button>
        </div>
        <button onClick={() => setModal("settings")}>
          <Settings size={16} />
          Test settings
        </button>
      </div>
      <ErrorBox error={error} />
      {message && (
        <div className="success">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}
      {!!duplicate.length && (
        <div className="notice slim">
          Possible duplicate questions:{" "}
          {duplicate.map((x) => x.i + 1).join(", ")}. Review before sharing.
        </div>
      )}
      <div className="editor-layout">
        <aside className="question-outline">
          <div className="outline-heading">
            <strong>Questions</strong>
            <span className="count">{doc.questions.length}</span>
          </div>
          {doc.questions.map((x, i) => (
            <button
              key={x.id}
              className={selected === i ? "selected" : ""}
              onClick={() => setSelected(i)}
            >
              <span className="outline-number">{i + 1}</span>
              <span>
                <small>{typeLabels[x.type]}</small>
                <strong>{x.text || "New question"}</strong>
              </span>
              {errorsFor(x).length ? (
                <span
                  className="incomplete-dot"
                  title="Needs an answer or text"
                />
              ) : (
                <Check size={13} className="green" />
              )}
            </button>
          ))}
          <button className="outline-add" onClick={() => setModal("add")}>
            <Plus size={16} />
            Add question
          </button>
          <div className="outline-tip">
            <BookOpen size={17} />
            <p>
              Small steps, good tests.
              <br />
              Your work saves automatically.
            </p>
          </div>
        </aside>
        <section className="question-stage">
          {q ? (
            <>
              <div className="question-toolbar">
                <span className="badge">QUESTION {selected + 1}</span>
                <div>
                  <button
                    className="icon"
                    aria-label="Move question up"
                    disabled={selected === 0}
                    onClick={() => {
                      const qs = [...doc.questions];
                      [qs[selected], qs[selected - 1]] = [
                        qs[selected - 1],
                        qs[selected],
                      ];
                      update({ questions: qs });
                      setSelected(selected - 1);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    className="icon"
                    aria-label="Move question down"
                    disabled={selected === doc.questions.length - 1}
                    onClick={() => {
                      const qs = [...doc.questions];
                      [qs[selected], qs[selected + 1]] = [
                        qs[selected + 1],
                        qs[selected],
                      ];
                      update({ questions: qs });
                      setSelected(selected + 1);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    className="icon"
                    aria-label="Duplicate question"
                    onClick={() => {
                      const clone = structuredClone(q);
                      clone.id = crypto.randomUUID();
                      clone.choices = clone.choices.map((c) => ({
                        ...c,
                        id: crypto.randomUUID(),
                      }));
                      clone.pairs = clone.pairs.map((p) => ({
                        ...p,
                        id: crypto.randomUUID(),
                      }));
                      update({ questions: [...doc.questions, clone] });
                      setSelected(doc.questions.length);
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon danger-text"
                    aria-label="Delete question"
                    onClick={() => {
                      if (confirm("Remove this question from the test?")) {
                        update({
                          questions: doc.questions.filter(
                            (_, i) => i !== selected,
                          ),
                        });
                        setSelected(Math.max(0, selected - 1));
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <QuestionEditor q={q} onChange={edit} />
              <div className="question-footer">
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("/bank", send("POST", q));
                      setMessage("A copy was saved to your question bank.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Library size={16} />
                  Save to question bank
                </button>
                <span>Only you can see correct answers here.</span>
              </div>
            </>
          ) : (
            <Empty
              title="Start with one good question."
              body="Choose a question type, or import a file you already have."
            >
              <Button onClick={() => setModal("add")}>
                <Plus size={17} />
                Add your first question
              </Button>
            </Empty>
          )}
        </section>
      </div>
      {modal === "add" && (
        <Modal
          title="What would you like to ask?"
          wide
          onClose={() => setModal(null)}
        >
          <p className="muted">
            Pick a question type. We’ll take care of the structure.
          </p>
          <div className="type-grid">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => {
                  update({ questions: [...doc.questions, newQuestion(k)] });
                  setSelected(doc.questions.length);
                  setModal(null);
                }}
              >
                <span className="type-mark">
                  {
                    {
                      multiple: "A",
                      truefalse: "T / F",
                      short: "Aa",
                      essay: "¶",
                      matching: "↔",
                      ordering: "1–2",
                      blanks: "___",
                      selection: "▾",
                      multimatch: "⇉",
                      numerical: "#",
                      list: "≡",
                      listprompt: "☷",
                      checklist: "☑",
                      statements: "T / F",
                      table: "▦",
                      diagram: "△",
                      multipart: "a,b",
                    }[k]
                  }
                </span>
                <strong>{typeLabels[k]}</strong>
                <small>
                  {
                    {
                      multiple: "Choose one or more answers",
                      truefalse: "Keep it simple: two choices",
                      short: "A word, phrase or sentence",
                      essay: "Give students room to explain",
                      matching: "Connect each item to its partner",
                      ordering: "Arrange items in the right order",
                      blanks: "Complete a sentence or passage",
                      selection: "Choose a word within a sentence",
                      multimatch: "Reuse choices across statements",
                      numerical: "A number, with optional tolerance",
                      list: "Ask for a list of items",
                      listprompt: "A separate response for each prompt",
                      checklist: "Select every correct item",
                      statements: "True or false for each statement",
                      table: "Fill selected cells in a table",
                      diagram: "Annotate a diagram or attach a drawing",
                      multipart: "Break a question into marked parts",
                    }[k]
                  }
                </small>
              </button>
            ))}
          </div>
          <p className="fine-print">
            Written, diagram and multi-part responses use teacher grading.
          </p>
        </Modal>
      )}
      {modal === "import" && (
        <ImportDialog
          onClose={() => setModal(null)}
          onImport={(qs) => {
            update({
              questions: [
                ...doc.questions,
                ...qs.map((q) => ({ ...q, id: crypto.randomUUID() })),
              ],
            });
            setSelected(doc.questions.length);
            setModal(null);
            setMessage(
              `${qs.length} questions added. Review them before sharing.`,
            );
          }}
        />
      )}
      {modal === "bank" && (
        <BankPicker
          onClose={() => setModal(null)}
          onAdd={(qs) => {
            update({
              questions: [
                ...doc.questions,
                ...qs.map((q) => ({
                  ...structuredClone(q),
                  id: crypto.randomUUID(),
                })),
              ],
            });
            setSelected(doc.questions.length);
            setModal(null);
          }}
        />
      )}
      {modal === "settings" && (
        <Modal
          title="Make it fit your classroom"
          onClose={() => setModal(null)}
        >
          <label>
            Instructions for students
            <textarea
              rows={3}
              value={doc.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Read each question carefully. Show your working where needed."
            />
          </label>
          <SettingsForm
            settings={doc.settings}
            change={(settings) => update({ settings })}
          />
          <div className="modal-actions">
            <Button onClick={() => setModal(null)}>
              Done
              <Check size={16} />
            </Button>
          </div>
        </Modal>
      )}
      {modal === "export" && (
        <ExportDialog
          doc={doc}
          ensureSaved={ensureSaved}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "share" && (
        <Modal title="Ready for your students?" onClose={() => setModal(null)}>
          {problems.length ? (
            <>
              <div className="notice">
                <strong>A few things need your attention</strong>
                <p>Complete these questions before sharing.</p>
              </div>
              {problems.map((p, i) => (
                <button
                  key={i}
                  className="issue-link"
                  onClick={() => {
                    setSelected(p.i);
                    setModal(null);
                  }}
                >
                  Question {p.i + 1}: {p.text}
                  <ArrowRight size={15} />
                </button>
              ))}
            </>
          ) : (
            <>
              <p className="muted">
                Sharing creates a fixed copy. Your students’ test stays
                consistent while you edit the draft.
              </p>
              <div className="share-summary">
                <span>
                  <FileText size={18} />
                  {doc.questions.length} questions
                </span>
                <span>
                  <Clock size={18} />
                  {doc.settings.timeLimit
                    ? `${doc.settings.timeLimit} minutes`
                    : "No time limit"}
                </span>
              </div>
              <label>
                Access code (optional)
                <input
                  value={doc.settings.accessCode}
                  onChange={(e) =>
                    update({
                      settings: { ...doc.settings, accessCode: e.target.value },
                    })
                  }
                  placeholder="Leave blank for open access"
                />
              </label>
              {share ? (
                <div className="share-link">
                  <label>
                    Student link
                    <input readOnly value={location.origin + share} />
                  </label>
                  <Button
                    secondary
                    onClick={() =>
                      navigator.clipboard
                        .writeText(location.origin + share)
                        .then(() => setMessage("Student link copied."))
                        .catch(() =>
                          setMessage("Select the link above and copy it."),
                        )
                    }
                  >
                    <Copy size={16} />
                    Copy link
                  </Button>
                  <a href={share} target="_blank" rel="noreferrer">
                    Open student view ↗
                  </a>
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    if (!(await ensureSaved())) return;
                    try {
                      const p = await api<{ url: string }>(
                        `/tests/${id}/publish`,
                        send("POST"),
                      );
                      setShare(p.url);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Share2 size={16} />
                  Create student link
                </Button>
              )}
              <p className="fine-print">
                Students enter their name and ID. No account or course
                enrollment needed.
              </p>
            </>
          )}
        </Modal>
      )}
      {modal === "preview" && (
        <Modal title="Student preview" wide onClose={() => setModal(null)}>
          <p className="muted">
            A practice view. Answers entered here are not saved or graded.
          </p>
          <h2>{doc.title}</h2>
          <p>{doc.description}</p>
          {doc.questions.map((q, i) => (
            <PreviewQuestion key={q.id} q={q} number={i + 1} />
          ))}
        </Modal>
      )}
    </>
  );
}

export function SettingsForm({
  settings: s,
  change,
}: {
  settings: TestSettings;
  change: (s: TestSettings) => void;
}) {
  const set = (p: Partial<TestSettings>) => change({ ...s, ...p });
  return (
    <>
      <div className="form-grid">
        <label>
          Title layout
          <select
            value={s.titleStyle}
            onChange={(e) =>
              set({ titleStyle: e.target.value as TestSettings["titleStyle"] })
            }
          >
            <option value="classic">Classic classroom</option>
            <option value="compact">Compact heading</option>
            <option value="exam">Formal exam</option>
          </select>
        </label>
        <label>
          Answer-sheet layout
          <select
            value={s.sheetStyle}
            onChange={(e) =>
              set({ sheetStyle: e.target.value as TestSettings["sheetStyle"] })
            }
          >
            <option value="standard">Standard</option>
            <option value="compact">Compact</option>
            <option value="lined">Extra writing space</option>
          </select>
        </label>
      </div>
      <div className="form-divider">ONLINE TESTING</div>
      <div className="form-grid">
        <label>
          Time limit (minutes)
          <input
            type="number"
            min={0}
            max={600}
            value={s.timeLimit}
            onChange={(e) => set({ timeLimit: Number(e.target.value) })}
          />
          <small>0 means no time limit.</small>
        </label>
        <label>
          Allowed attempts
          <input
            type="number"
            min={1}
            max={10}
            value={s.attempts}
            onChange={(e) => set({ attempts: Number(e.target.value) })}
          />
        </label>
      </div>
      <label>
        After submitting
        <select
          value={s.feedback}
          onChange={(e) =>
            set({ feedback: e.target.value as TestSettings["feedback"] })
          }
        >
          <option value="score">Show score only</option>
          <option value="answers">Show score and correct answers</option>
          <option value="none">Show confirmation only</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.shuffleQuestions}
          onChange={(e) => set({ shuffleQuestions: e.target.checked })}
        />
        Shuffle group order and ungrouped questions
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.shuffleWithinGroups}
          onChange={(e) => set({ shuffleWithinGroups: e.target.checked })}
        />
        Shuffle questions inside each group
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.shuffleChoices}
          onChange={(e) => set({ shuffleChoices: e.target.checked })}
        />
        Shuffle unlocked answer choices
      </label>
      <div className="form-divider">PRINTED TESTS</div>
      <div className="form-grid">
        <label>
          Paper size
          <select
            value={s.paper}
            onChange={(e) =>
              set({ paper: e.target.value as TestSettings["paper"] })
            }
          >
            <option>A4</option>
            <option>Letter</option>
          </select>
        </label>
        <label>
          Columns
          <select
            value={s.columns}
            onChange={(e) => set({ columns: Number(e.target.value) })}
          >
            <option value={1}>One column</option>
            <option value={2}>Two columns</option>
          </select>
        </label>
      </div>
      <label>
        Header
        <input
          value={s.header}
          onChange={(e) => set({ header: e.target.value })}
        />
      </label>
      <label>
        Footer
        <input
          value={s.footer}
          onChange={(e) => set({ footer: e.target.value })}
        />
      </label>
      <label>
        Watermark text
        <input
          value={s.watermark}
          onChange={(e) => set({ watermark: e.target.value })}
          placeholder="e.g. PRACTICE"
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.showMarks}
          onChange={(e) => set({ showMarks: e.target.checked })}
        />
        Show marks beside each question
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.subNumber || false}
          onChange={(e) => set({ subNumber: e.target.checked })}
        />
        Use decimal numbering within groups (3.1, 3.2…)
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={s.verticalMarks || false}
          onChange={(e) => set({ verticalMarks: e.target.checked })}
        />
        Display marks on a separate line
      </label>
      <label>
        Space between printed questions: {s.questionSpacing ?? 22}px
        <input
          type="range"
          min={5}
          max={60}
          value={s.questionSpacing ?? 22}
          onChange={(e) => set({ questionSpacing: Number(e.target.value) })}
        />
      </label>
      <label>
        Background image or watermark
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || file.size > 2500000) return;
            const reader = new FileReader();
            reader.onload = () =>
              set({ backgroundImage: String(reader.result) });
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {s.backgroundImage && (
        <button
          className="text-button"
          onClick={() => set({ backgroundImage: "" })}
        >
          Remove background image
        </button>
      )}
      <LayoutPresets settings={s} change={change} />
    </>
  );
}

export function QuestionEditor({
  q,
  onChange,
}: {
  q: Question;
  onChange: (q: Question) => void;
}) {
  const [advanced, setAdvanced] = useState(false),
    [picture, setPicture] = useState(false);
  const set = (p: Partial<Question>) => onChange({ ...q, ...p });
  const [uploadError, setUploadError] = useState("");
  return (
    <>
      <div className="question-type-heading">
        <h2>{typeLabels[q.type]}</h2>
        <label className="marks-input">
          Marks
          <input
            type="number"
            min={0}
            max={1000}
            value={q.marks}
            readOnly={q.type === "multipart"}
            onChange={(e) => set({ marks: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="question-label">
        What’s your question?
        <RichTextEditor key={q.id} q={q} change={set} />
      </div>
      {["selection", "blanks"].includes(q.type) && (
        <small className="hint">
          Select a word in the question, then use “Make selected text a blank”.
          You can also type ___ to add a blank.
        </small>
      )}
      {q.type === "selection" && <InlineEditor q={q} change={set} />}
      {q.image ? (
        <div className="question-image">
          <img src={q.image} alt={q.imageAlt || "Question illustration"} />
          <div>
            <Button secondary onClick={() => setPicture(true)}>
              Edit picture
            </Button>
            <button
              className="icon"
              aria-label="Remove image"
              onClick={() => set({ image: "" })}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <label className="image-upload">
          <ImageIcon size={17} />
          Add a picture
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2500000) {
                setUploadError("Choose a picture smaller than 2.5 MB.");
                return;
              }
              if (
                ![
                  "image/png",
                  "image/jpeg",
                  "image/gif",
                  "image/webp",
                ].includes(file.type)
              ) {
                setUploadError("Use PNG, JPEG, GIF or WebP.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                set({
                  image: String(reader.result),
                  imageOriginal: String(reader.result),
                  imageRecipe: "",
                });
                setUploadError("");
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      )}
      <ErrorBox error={uploadError} />
      {["multiple", "truefalse", "selection", "checklist"].includes(q.type) &&
        !q.selections?.length && (
          <div className="choices-editor">
            <div className="field-heading">
              <strong>Answer choices</strong>
              <span>Tick every correct answer</span>
            </div>
            {q.choices.map((c, i) => (
              <div
                className={`choice-edit ${c.correct ? "correct" : ""}`}
                key={c.id}
              >
                <label className="correct-control" title="Correct answer">
                  <input
                    type="checkbox"
                    aria-label={`Choice ${i + 1} is correct`}
                    checked={c.correct}
                    onChange={(e) =>
                      set({
                        choices: q.choices.map((x) =>
                          x.id === c.id
                            ? { ...x, correct: e.target.checked }
                            : q.type === "truefalse" || q.type === "selection"
                              ? { ...x, correct: false }
                              : x,
                        ),
                      })
                    }
                  />
                  <span>
                    {c.correct ? (
                      <Check size={16} />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </span>
                </label>
                <input
                  aria-label={`Answer choice ${i + 1}`}
                  value={c.text}
                  readOnly={q.type === "truefalse"}
                  onChange={(e) =>
                    set({
                      choices: q.choices.map((x) =>
                        x.id === c.id ? { ...x, text: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                />
                <button
                  className="icon"
                  aria-label={
                    c.locked
                      ? "Allow choice to shuffle"
                      : "Keep choice in this position"
                  }
                  title={
                    c.locked
                      ? "Position locked"
                      : "Lock position when shuffling"
                  }
                  onClick={() =>
                    set({
                      choices: q.choices.map((x) =>
                        x.id === c.id ? { ...x, locked: !x.locked } : x,
                      ),
                    })
                  }
                >
                  {c.locked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
                {q.type !== "truefalse" && (
                  <button
                    className="icon"
                    aria-label="Remove choice"
                    disabled={q.choices.length <= 2}
                    onClick={() =>
                      set({ choices: q.choices.filter((x) => x.id !== c.id) })
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {q.type !== "truefalse" && (
              <button
                className="text-button add-choice"
                onClick={() =>
                  set({
                    choices: [
                      ...q.choices,
                      {
                        id: crypto.randomUUID(),
                        text: "",
                        correct: false,
                        locked: false,
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Add another choice
              </button>
            )}
            <div className="answer-hint">
              <CheckCircle2 size={16} />
              {q.choices.some((c) => c.correct)
                ? `Correct answer${q.choices.filter((c) => c.correct).length > 1 ? "s" : ""}: ${q.choices
                    .map((c, i) =>
                      c.correct ? String.fromCharCode(65 + i) : "",
                    )
                    .filter(Boolean)
                    .join(", ")}`
                : "Mark the correct answer so we can grade it for you."}
            </div>
          </div>
        )}
      {specialKinds.includes(q.type) && <SpecialEditor q={q} change={set} />}
      {["short", "essay", "blanks", "numerical"].includes(q.type) && (
        <div className="answer-editor">
          {q.type === "short" && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={q.manual}
                onChange={(e) => set({ manual: e.target.checked })}
              />
              I’ll grade this question myself
            </label>
          )}
          {q.type === "blanks" ? (
            <div>
              <strong>Answers for the blanks</strong>
              {Array.from(
                { length: q.text.split("___").length - 1 },
                (_, i) => (
                  <label key={i}>
                    Blank {i + 1}
                    <input
                      value={q.answer.split("|")[i] || ""}
                      onChange={(e) => {
                        const answers = Array.from(
                          { length: q.text.split("___").length - 1 },
                          (_, j) => q.answer.split("|")[j] || "",
                        );
                        answers[i] = e.target.value;
                        set({ answer: answers.join("|") });
                      }}
                    />
                  </label>
                ),
              )}
            </div>
          ) : (
            <>
              {" "}
              <label>
                {q.type === "essay" || (q.type === "short" && q.manual)
                  ? "Answer guide (for you only)"
                  : "Accepted answer"}
                <textarea
                  rows={3}
                  value={q.answer}
                  onChange={(e) => set({ answer: e.target.value })}
                  placeholder={
                    q.type === "short"
                      ? "Separate alternative accepted answers with |"
                      : "Add the answer or grading guidance…"
                  }
                />
              </label>
            </>
          )}
          {q.type === "numerical" && (
            <label>
              Tolerance (±)
              <input
                type="number"
                min={0}
                step="any"
                value={q.tolerance}
                onChange={(e) => set({ tolerance: Number(e.target.value) })}
              />
            </label>
          )}
          <small className="hint">
            {q.type === "essay" || (q.type === "short" && q.manual)
              ? "Responses appear in Results for teacher grading."
              : "Text matching ignores letter case and extra spaces. Full credit only; no automatic partial credit."}
          </small>
        </div>
      )}
      {["matching", "multimatch", "ordering"].includes(q.type) && (
        <div className="pairs-editor">
          <p className="hint">
            {q.type === "ordering"
              ? "Enter items in the correct order. Students will see a shuffled list."
              : q.type === "multimatch"
                ? "Add each statement and its correct match. Matches can repeat."
                : "Add each item and its correct partner. Students select from a shuffled list."}
          </p>
          {q.pairs.map((p, i) => (
            <div className="pair-row" key={p.id}>
              <span>{i + 1}</span>
              <input
                aria-label={`Item ${i + 1}`}
                placeholder={
                  q.type === "ordering"
                    ? "Item in correct order"
                    : "Statement or item"
                }
                value={p.left}
                onChange={(e) =>
                  set({
                    pairs: q.pairs.map((x) =>
                      x.id === p.id ? { ...x, left: e.target.value } : x,
                    ),
                  })
                }
              />
              {q.type !== "ordering" && (
                <>
                  <ArrowRight size={16} />
                  <input
                    aria-label={`Match ${i + 1}`}
                    placeholder="Correct match"
                    value={p.right}
                    onChange={(e) =>
                      set({
                        pairs: q.pairs.map((x) =>
                          x.id === p.id ? { ...x, right: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </>
              )}
              <button
                className="icon"
                aria-label="Remove item"
                onClick={() =>
                  set({ pairs: q.pairs.filter((x) => x.id !== p.id) })
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <button
            className="text-button"
            onClick={() =>
              set({
                pairs: [
                  ...q.pairs,
                  { id: crypto.randomUUID(), left: "", right: "" },
                ],
              })
            }
          >
            <Plus size={16} />
            Add an item
          </button>
        </div>
      )}
      {["matching", "multimatch"].includes(q.type) && (
        <label>
          Additional possible matches (one per line)
          <textarea
            rows={3}
            value={(q.matchOptions || []).join("\n")}
            onChange={(e) => set({ matchOptions: e.target.value.split("\n") })}
            placeholder="Optional choices that can be left unused"
          />
          <small>
            These appear alongside the correct matches. Students may use a
            choice more than once in multi-match questions.
          </small>
        </label>
      )}
      {q.type === "multiple" && (
        <label>
          Number of choices to show
          <input
            type="number"
            min={0}
            max={q.choices.length}
            value={q.choiceLimit || 0}
            onChange={(e) => set({ choiceLimit: Number(e.target.value) })}
          />
          <small>
            0 shows all. Other choices are selected randomly; correct and locked
            choices stay included.
          </small>
        </label>
      )}
      {q.image && (
        <label>
          Picture description
          <input
            value={q.imageAlt || ""}
            onChange={(e) => set({ imageAlt: e.target.value })}
            placeholder="Describe the picture for students using a screen reader"
          />
        </label>
      )}
      <button
        className="advanced-toggle"
        onClick={() => setAdvanced(!advanced)}
      >
        <ChevronDown size={16} className={advanced ? "rotated" : ""} />
        More options <span>Category, grouping & teacher notes</span>
      </button>
      {advanced && (
        <div className="advanced-fields">
          <div className="form-grid">
            <label>
              Category
              <input
                value={q.category}
                onChange={(e) => set({ category: e.target.value })}
                placeholder="e.g. Science"
              />
            </label>
            <label>
              Group name
              <input
                value={q.group}
                onChange={(e) => set({ group: e.target.value })}
                placeholder="Keep adjacent questions together"
              />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={q.pageBreak || false}
              onChange={(e) => set({ pageBreak: e.target.checked })}
            />
            Start this question on a new printed page
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={q.keepTogether !== false}
              onChange={(e) => set({ keepTogether: e.target.checked })}
            />
            Keep this question together on a printed page
          </label>
          <label>
            Private teacher notes
            <textarea
              rows={3}
              value={q.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
        </div>
      )}
      {picture && (
        <PictureEditor
          source={q.imageOriginal || q.image}
          recipe={q.imageRecipe || ""}
          onClose={() => setPicture(false)}
          onSave={(image, recipe) => {
            set({
              image,
              imageOriginal: q.imageOriginal || q.image,
              imageRecipe: recipe,
            });
            setPicture(false);
          }}
        />
      )}
    </>
  );
}

export function ExportDialog({
  doc,
  ensureSaved,
  onClose,
}: {
  doc: Test;
  ensureSaved: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [gift, setGift] = useState<{ text: string; warnings: string[] } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false);
  const [exportFormat, setExportFormat] = useState("gift");
  const [qti, setQti] = useState<string[] | null>(null),
    [qtiAck, setQtiAck] = useState(false);
  async function saveQti() {
    try {
      if (!(await ensureSaved())) return;
      const r = await fetch(`/api/tests/${doc.id}/export/qti`);
      if (!r.ok) throw new Error("QTI export failed.");
      download("questions.qti.zip", await r.blob());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function native() {
    setBusy(true);
    try {
      if (!(await ensureSaved()))
        throw new Error("Save the test before exporting.");
      const r = await fetch(`/api/tests/${doc.id}/export/native`);
      if (!r.ok) throw new Error("The export could not be created.");
      download(
        `${doc.title.replace(/[^a-z0-9 _-]/gi, "") || "test"}.classpaper.zip`,
        await r.blob(),
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Take your questions anywhere" onClose={onClose}>
      <p className="muted">
        A native package keeps every question, picture and setting.
      </p>
      <button className="export-option" disabled={busy} onClick={native}>
        <div className="subject-icon">
          <FileText size={22} />
        </div>
        <div>
          <strong>Complete Classpaper package</strong>
          <small>ZIP · full data and pictures · recommended backup</small>
        </div>
        <Download size={18} />
      </button>
      <button
        className="export-option"
        onClick={async () => {
          try {
            if (!(await ensureSaved())) return;
            setAck(false);
            setExportFormat("gift");
            setGift(await api(`/tests/${doc.id}/export/gift`));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="subject-icon tone-1">
          <ArrowRight size={22} />
        </div>
        <div>
          <strong>GIFT for Moodle and other tools</strong>
          <small>Text format · review compatibility before exporting</small>
        </div>
        <ChevronRight size={18} />
      </button>
      <button
        className="export-option"
        onClick={async () => {
          try {
            if (!(await ensureSaved())) return;
            const r = await api<{ warnings: string[] }>(
              `/tests/${doc.id}/export/qti?preview=1`,
            );
            setQti(r.warnings);
            setGift(null);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="subject-icon tone-2">
          <FileText size={22} />
        </div>
        <div>
          <strong>QTI 2.1 assessment package</strong>
          <small>
            Bounded interaction subset · review scoring compatibility
          </small>
        </div>
        <ChevronRight size={18} />
      </button>
      {qti && (
        <>
          {!!qti.length && (
            <>
              <div className="notice">
                <strong>QTI export limitations</strong>
                {qti.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={qtiAck}
                  onChange={(e) => setQtiAck(e.target.checked)}
                />
                I understand which data and questions will not transfer.
              </label>
            </>
          )}
          <Button disabled={!!qti.length && !qtiAck} onClick={saveQti}>
            <Download size={16} />
            Download QTI package
          </Button>
        </>
      )}
      <button
        className="export-option"
        onClick={async () => {
          try {
            if (!(await ensureSaved())) return;
            setAck(false);
            setExportFormat("csv");
            setGift(await api(`/tests/${doc.id}/export/csv`));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <strong>Spreadsheet CSV</strong>
        <small>
          Supported types · review omitted formatting · import text fields as
          text
        </small>
      </button>
      <p className="fine-print">
        QTI is a defined subset, not universal compatibility. ZipGrade scanning
        validation is still planned.
      </p>
      <ErrorBox error={error} />
      {gift && (
        <>
          {!!gift.warnings.length && (
            <>
              <div className="notice">
                <strong>This export has limitations</strong>
                {gift.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I understand these limitations.
              </label>
            </>
          )}
          <div className="modal-actions">
            <Button
              disabled={!!gift.warnings.length && !ack}
              onClick={() => {
                download(`questions.${exportFormat}`, gift.text);
                onClose();
              }}
            >
              <Download size={16} />
              Download {exportFormat.toUpperCase()}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function LayoutPresets({
  settings,
  change,
}: {
  settings: TestSettings;
  change: (s: TestSettings) => void;
}) {
  const [presets, setPresets] = useState<
      { id: string; name: string; settings: TestSettings }[]
    >([]),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<typeof presets>("/presets")
      .then(setPresets)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="preset-editor">
      <div className="form-divider">REUSABLE PRINT PRESETS</div>
      <label>
        Use a saved preset
        <select
          defaultValue=""
          onChange={(e) => {
            const p = presets.find((p) => p.id === e.target.value);
            if (p)
              change({
                ...settings,
                paper: p.settings.paper,
                columns: p.settings.columns,
                showMarks: p.settings.showMarks,
                header: p.settings.header,
                footer: p.settings.footer,
                watermark: p.settings.watermark,
                subNumber: p.settings.subNumber,
                verticalMarks: p.settings.verticalMarks,
                backgroundImage: p.settings.backgroundImage,
                questionSpacing: p.settings.questionSpacing,
                titleStyle: p.settings.titleStyle || "classic",
                sheetStyle: p.settings.sheetStyle || "standard",
              });
          }}
        >
          <option value="">Choose a preset…</option>
          {presets.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Save current print settings as
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekly science quiz"
        />
      </label>
      <Button
        secondary
        disabled={!name.trim()}
        onClick={async () => {
          try {
            const p = await api<{
              id: string;
              name: string;
              settings: TestSettings;
            }>("/presets", send("POST", { name, settings }));
            setPresets([...presets, p]);
            setName("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Save size={15} />
        Save print preset
      </Button>
      <ErrorBox error={error} />
    </div>
  );
}
