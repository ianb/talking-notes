# Spotter — ideas backlog

Loose ideas for the spotter demo that aren't in scope right now. Promote
to real work when one of them earns it.

## Silence markers in the transcript

When no transcription deltas arrive for more than a couple of seconds,
break the transcript with a horizontal rule labelled with the elapsed
duration (e.g. `── 4s ──`). Helps a viewer eyeball pacing and pauses
without listening back to audio.

Sketch:

- Track `lastDeltaAt` in `SpotterApp` (or in `useLiveTranscription`
  itself, exposed as part of its state).
- When the gap since the last delta crosses a threshold (say 2s) and a
  new delta lands, insert a sentinel into the rendered transcript at the
  boundary. The transcript string itself probably shouldn't carry the
  marker — render it as a separate element keyed off a list of
  `{ index, durationMs }` gap records that lives alongside the text.
- Threshold should probably be tunable; very short gaps between
  utterances are normal and shouldn't clutter the view.
