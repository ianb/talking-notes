# Voice Reading Demo — Minnebar 2026

**Context:** Demo for Minnebar voice unconference session

## Core Concept

An app for reading while using your voice to take notes at the same time. You read, you reflect aloud, and the app captures your voice reactions alongside your reading activity. When you're done, you trigger a completion step and the LLM synthesizes everything into an annotated document or reading journal.

## Tech Stack

- OpenAI API key entered directly (paste-in on first use) — no backend needed
- Whisper for voice transcription
- GPT for alignment, classification, and synthesis

## User Flow

1. Paste in OpenAI API key
2. Import a document (Markdown primary; conversion from other formats possible)
3. Read, speak, select text, scroll — all tracked
4. Hit "Complete" to trigger LLM synthesis
5. View results in one of two output views

## Input

- Import a document (Markdown primary; conversion from other formats possible)
- **URL-to-Markdown:** Use Jina Reader — prepend `https://r.jina.ai/` to any URL, returns clean Markdown, no API key needed. Firecrawl is the heavier alternative if needed.
- Document is parsed into explicit paragraph segments for alignment

## Data Streams Captured

While reading, two streams are tracked in parallel:

- **Voice** — continuously transcribed via Whisper, with timestamps
- **Activity** — behavioral signals:
  - Scroll position (which paragraph you're on)
  - Text selection
  - Explicit markups/annotations

## Processing (triggered on "Complete")

### LLM Alignment

The LLM receives:

- The full document text
- The voice transcript (flagged as potentially inaccurate — use document context to interpret and correct)
- Activity stream (scroll position, selections, timestamps)

Document context helps the LLM interpret transcription errors (e.g., technical terms Whisper got wrong).

### Voice Chunk Classification

For each voice segment, the LLM classifies it as:

- **Invalid** — noise, ambient sound, not useful → discard
- **Aside** — standalone thought, not tied to a specific passage; may still reference or react to something in the document
- **Annotation** — directly tied to a location in the document

Citations (inline or block quote) can arise from either:

- Reading text aloud (LLM matches transcript to source)
- Explicit text selection (exact reference known)

## Output Structure

Both views share the same underlying representation: voice chunks with references into the original document, sequenced by time/position.

Possibly two separate LLM prompts for the two views, or one shared intermediate representation rendered differently.

## Output Views

### 1. Annotated Document View

The original document with voice annotations woven in at the relevant passages — like margin notes, positioned by where you were in the document when you spoke.

### 2. Statements + Quotes View

Your spoken notes as the primary text, with document quotes as citations (inline or block). A reading journal — your reactions with supporting evidence.
