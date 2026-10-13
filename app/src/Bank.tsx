import { Eye, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, send } from "./api";
import { Button, Empty, ErrorBox, Modal, answerText } from "./common";
import { kinds, typeLabels, type Question } from "./domain";
import { PreviewQuestion } from "./QuestionViews";
import { QuestionText } from "./RichDisplay";

export function Bank() {
  const [qs, setQs] = useState<Question[]>([]),
    [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [preview, setPreview] = useState<Question | null>(null),
    [error, setError] = useState("");
  const load = () =>
    api<Question[]>("/bank")
      .then(setQs)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <header className="topbar">A home for your best questions.</header>
      <div className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">GOOD QUESTIONS ARE WORTH KEEPING</div>
            <h1>
              Question bank<span className="serif">.</span>
            </h1>
            <p className="muted">Save once. Reuse in your next lesson.</p>
          </div>
          <span className="badge">{qs.length} saved questions</span>
        </div>
        <div className="bank-filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search question bank"
              placeholder="Search text or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Question type filter"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">All question types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {typeLabels[k]}
              </option>
            ))}
          </select>
        </div>
        <ErrorBox error={error} />
        {!qs.length ? (
          <Empty
            title="Keep your best questions close."
            body="Open a test and use “Save to question bank” to start your collection."
          />
        ) : (
          <div className="bank-list">
            {qs
              .filter(
                (q) =>
                  (type === "all" || q.type === type) &&
                  `${q.text} ${q.category}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((q) => (
                <div className="bank-item" key={q.id}>
                  <div className="subject-icon">
                    <FileText size={21} />
                  </div>
                  <button onClick={() => setPreview(q)}>
                    <small>
                      {typeLabels[q.type]} · {q.category || "Uncategorized"}
                    </small>
                    <div className="question-body">
                      <QuestionText q={q} />
                    </div>
                  </button>
                  <span>{q.marks} marks</span>
                  <button
                    className="icon"
                    aria-label="Preview question"
                    onClick={() => setPreview(q)}
                  >
                    <Eye size={17} />
                  </button>
                  <button
                    className="icon"
                    aria-label="Delete bank question"
                    onClick={async () => {
                      if (
                        confirm(
                          "Remove this saved question? Existing tests keep their copy.",
                        )
                      ) {
                        await api(`/bank/${q.id}`, send("DELETE"));
                        load();
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
      {preview && (
        <Modal title="Question preview" wide onClose={() => setPreview(null)}>
          <PreviewQuestion q={preview} number={1} />
          <div className="answer-hint">
            Answer: {answerText(preview) || "Teacher grading"}
          </div>
          {preview.notes && (
            <p className="muted">Teacher notes: {preview.notes}</p>
          )}
        </Modal>
      )}
    </>
  );
}

export function BankPicker({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (qs: Question[]) => void;
}) {
  const [qs, setQs] = useState<Question[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<Question[]>("/bank")
      .then(setQs)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="Choose from your question bank" wide onClose={onClose}>
      <label className="search">
        <Search size={17} />
        <input
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <ErrorBox error={error} />
      <div className="bank-picker">
        {qs
          .filter((q) => q.text.toLowerCase().includes(search.toLowerCase()))
          .map((q) => (
            <label className="bank-pick" key={q.id}>
              <input
                type="checkbox"
                checked={selected.includes(q.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, q.id]
                      : selected.filter((id) => id !== q.id),
                  )
                }
              />
              <div>
                <small>
                  {typeLabels[q.type]} · {q.category || "Uncategorized"}
                </small>
                <p>{q.text}</p>
                <small>Answer: {answerText(q) || "Teacher grading"}</small>
              </div>
            </label>
          ))}
        {!qs.length && (
          <p className="muted">
            Save questions from a test to build your bank.
          </p>
        )}
      </div>
      <div className="modal-actions">
        <Button
          disabled={!selected.length}
          onClick={() => onAdd(qs.filter((q) => selected.includes(q.id)))}
        >
          Add {selected.length} questions
          <Plus size={16} />
        </Button>
      </div>
    </Modal>
  );
}
