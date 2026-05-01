# Language Learning — spotter mode

**Context:** A spotter mode for the Minnebar voice unconference. The
user speaks primarily in Spanish and uses English markers to interject:

- **`question` … `send`** brackets a quick English question. The
  bracketed span is shipped to a fast LLM, which extracts the actual
  question (cleaning filler) and answers it. The Q&A appears as a card
  in the log below the transcript.
- **`critique this`** asks the LLM for feedback on everything spoken so
  far in the session, with question detours stripped out. The result
  appears as its own card in the same log.

## Why a mode and not a separate page

This started as a standalone demo. Promoting it to a spotter mode buys
us the shared transcript pane, the recording controls, the keyword
panel cheat-sheet, and the voice-driven mode switcher — all the shell
pieces are reused. The mode-only payload is the log of Q&A and
critique cards (rendered below the transcript) plus the dispatch hooks
that talk to OpenAI.

## State shape

- `qaCalls`: derived from the `question`/`send` matches via
  `deriveQaState`. Each completed bracket has a stable id keyed on its
  char range.
- `critiqueCalls`: derived via `deriveCritiqueCalls` — for each
  `critique this` marker, slice out the Spanish content of the section
  ending at that marker (excluding any question…send brackets in that
  section). Empty sections are skipped.
- `answers` / `critiques`: per-id state maps populated asynchronously
  by `useAnswerDispatch` / `useCritiqueDispatch`. The dispatch hooks
  store controllers in a ref, fire fetches lazily, and abort only on
  unmount or explicit reset — so transcript deltas don't tear down
  in-flight fetches the way an effect cleanup would.

## Transcript reset

Out of scope for now: the user can keep talking after a critique and
the shell's transcript pane keeps showing everything. If the visible
transcript piling up becomes annoying, the cleanest fix is a
shell-level concept where the active mode can advance a "displayed
start" anchor; today we live with the continuous transcript.

## Why single-word `question` and `send` triggers

The spotter project memo says default to ≥2-word triggers because
single common English words fire too often. We deliberately lift that
rule here: the user is speaking Spanish, so the English words
`question` and `send` rarely show up incidentally. `critique this` is
already two words. If the user code-switches enough that the single
words become noisy, broaden them (e.g. `start question` /
`send question`) before adding more aliases.

## LLM contracts

Both calls use `gpt-4o-mini` with `response_format: json_object`.

- **Q&A:** `{ "question": "...", "answer": "..." }` — the model cleans
  up filler from the spoken English and answers concisely.
- **Critique:** `{ "critique": "..." }` — short, friendly feedback on
  one or two strengths and one or two improvements.

System prompts and parsers live in `llmAnswer.ts` and `llmCritique.ts`.
