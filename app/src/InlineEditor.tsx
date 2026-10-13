import type { Question } from "./domain";
export function InlineEditor({
  q,
  change,
}: {
  q: Question;
  change: (p: Partial<Question>) => void;
}) {
  const sets = q.selections || [];
  return (
    <section>
      <p>For several blanks, type one ___ for each choice set.</p>
      <button
        className="text-button"
        onClick={() =>
          change({
            selections: [
              ...sets,
              {
                id: crypto.randomUUID(),
                choices: sets.length
                  ? ["", ""].map((text, i) => ({
                      id: crypto.randomUUID(),
                      text,
                      correct: i === 0,
                      locked: false,
                    }))
                  : structuredClone(q.choices),
              },
            ],
          })
        }
      >
        Add a choice set
      </button>
      {sets.map((s, i) => (
        <fieldset key={s.id}>
          <legend>Blank {i + 1}</legend>
          {s.choices.map((c, j) => (
            <label className="check-row" key={c.id}>
              <input
                type="radio"
                aria-label={`Blank ${i + 1} choice ${j + 1} correct`}
                checked={c.correct}
                onChange={() =>
                  change({
                    selections: sets.map((x) =>
                      x.id === s.id
                        ? {
                            ...x,
                            choices: x.choices.map((v) => ({
                              ...v,
                              correct: v.id === c.id,
                            })),
                          }
                        : x,
                    ),
                  })
                }
              />
              <input
                aria-label={`Blank ${i + 1} choice ${j + 1}`}
                value={c.text}
                onChange={(e) =>
                  change({
                    selections: sets.map((x) =>
                      x.id === s.id
                        ? {
                            ...x,
                            choices: x.choices.map((v) =>
                              v.id === c.id
                                ? { ...v, text: e.target.value }
                                : v,
                            ),
                          }
                        : x,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            className="text-button"
            onClick={() =>
              change({
                selections: sets.map((x) =>
                  x.id === s.id
                    ? {
                        ...x,
                        choices: [
                          ...x.choices,
                          {
                            id: crypto.randomUUID(),
                            text: "",
                            correct: false,
                            locked: false,
                          },
                        ],
                      }
                    : x,
                ),
              })
            }
          >
            Add choice
          </button>
          <button
            className="text-button"
            onClick={() =>
              change({ selections: sets.filter((x) => x.id !== s.id) })
            }
          >
            Remove set
          </button>
        </fieldset>
      ))}
    </section>
  );
}
