# Working in this repo

## Project context

This is a **Minnebar 2026 voice unconference demo**. The repo is a host
shell that carries multiple sibling experiences — small voice / reading
demos that share a common API-key setup. The original brief
(`src/demos/reading/DESIGN.md`) is the reading-while-talking flow; more
experiences are being designed and will land as siblings under
`src/demos/`.

## Architecture

Vite + React 19 + TS. TanStack Router (file-based) handles routing.

- `src/routes/` — file-based routes; the Vite plugin generates
  `src/routeTree.gen.ts` (committed)
  - `__root.tsx` — wraps everything in `ApiKeysProvider`
  - `index.tsx` — home: API key form + nav to demos
  - `<demo>.tsx` — one route file per demo, mounting that demo's app
- `src/apiKeys.tsx` — shared OpenAI + Mistral keys via context, persisted
  to `localStorage`. In dev only, falls back to `.env` (gated by
  `import.meta.env.DEV` — production never reads `.env`)
- `src/demos/<name>/` — each demo owns its own state, components, hooks,
  `api/`, `utils/`, `audio/`, types, and a `DESIGN.md`. Read keys via
  `useApiKeys()` from the root
- `src/main.tsx` — bootstraps `RouterProvider`
- `vite.config.ts` — `TanStackRouterVite` plugin first; also a custom
  `voxtralProxy` plugin that proxies `/transcribe-ws` to Mistral so the
  browser doesn't need to expose the key to a third party

Each demo is automatically code-split by route. The reading demo is the
reference — copy its shape when adding a new one.

**To add a new demo:**
1. Create `src/demos/<name>/` with whatever internal structure fits
2. Add `src/routes/<name>.tsx` that mounts the demo's root component
3. Link it from the "Experiences" section of `src/routes/index.tsx`

## Tooling

- `@ianbicking/personal-vibe-check` provides the ESLint config + tsconfig
  base. The lint rules are strict and intentional (no optional chaining,
  custom error classes, max 2 positional params, no setState in render or
  effects, etc.) — read its `CONVENTIONS.md` if a rule surprises you
- `tap` for tests; tests mirror the `src/` tree under `test/`
- `.env` (gitignored) carries `OPENAI_API_KEY` and `MISTRAL_API_KEY`,
  loaded via `vite.config.ts:envPrefix`

## Tend the codebase

Tend this project with the care of a gardener — always leave it better than
you found it.

- **Fix what you touch.** If you edit a file, fix the lint and typecheck
  errors you can see in it, not just the ones you introduced. The same goes
  for stale comments, dead imports, and obvious bugs in adjacent code.
- **Don't dismiss problems as "pre-existing."** A pre-existing failure that
  you noticed and ignored is now a failure you signed off on.
- **Confirm green before reporting done.** `npm run lint`,
  `npm run typecheck`, and `npm test` should all be clean before saying a
  task is complete. If you can't make them all clean, surface that
  explicitly.
- **Don't tile around mess.** If you're about to write code that works
  around something broken, fix the broken thing instead.

## Right thing over easy thing

When two paths are open, pick the one that yields stronger types, better
reuse, or fewer bug surfaces — even when it costs more effort. Resist the
temptation to ship the lazy version with a TODO. The lazy version becomes
permanent more often than not.

## Comment for your future self

Code that reflects something you had to figure out deserves a short
comment explaining *why* it is that way: a subtle constraint, a
counterintuitive library quirk, a workaround whose motivation isn't
visible from the diff. Don't document what the code does — naming handles
that. Document the things a future reader (often me) would otherwise have
to re-derive or get wrong again.

This is a small demo project, but the habits matter more than the scale.
