# Language Learning Demo — Minnebar 2026

**Context:** Demo for the Minnebar voice unconference session.

## Core Concept

You speak in your target language (hardcoded to Spanish for the
unconference) and occasionally interject an English question by
bracketing it with the words **`question`** and **`send`**. The bracketed
chunk is shipped to a fast LLM, which extracts the actual question and
returns an answer; both are displayed below the live transcript.

Example:

> "sí, tengo muchos … *question* how do you say dogs? *send* … entonces …"

→

> **Q:** How do you say "dogs"?  
> **A:** "perro" (singular) or "perros" (plural).

## Why single-word triggers

The spotter project memo says default to two-word triggers because
single common English words fire too easily in normal speech. We
deliberately lift that rule here: the user is speaking primarily in
Spanish, so the English words `question` and `send` rarely show up
incidentally. If the user code-switches enough that this becomes a
problem, the trigger phrasing is the first thing to revisit.

## State machine (pure)

Walk transcript + question/send matches in left-to-right order. The
state machine is small: `idle` ↔ `collecting`. Each `question` while
idle opens a question span; each `send` while collecting closes it and
emits a Q&A call (skipping empty spans).

Async results are stored in an `answers` cache keyed by the span's char
range — derive logic is pure and can re-run on every render without
losing in-flight work.

## LLM contract

`gpt-4o-mini` with `response_format: { type: "json_object" }`. The
system prompt asks the model to extract the user's actual question
(cleaning filler) and answer it concisely; the answer may include
target-language vocabulary. Schema:

```json
{ "question": "...", "answer": "..." }
```

## Out of scope (for now)

- Choosing the target language at runtime (hardcoded; bump
  `TARGET_LANGUAGE` in `llmAnswer.ts` if needed).
- Cancel mid-question. To bail, just say `send` with no English between
  — the empty-question case is a no-op.
- Audio of the answer played back. Could be useful pedagogically but is
  out of scope for the unconference demo.
