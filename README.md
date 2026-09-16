<div align="center">

<img src="public/brand/sigil-mark.svg" width="72" height="72" alt="SIGIL">

# SIGIL

**AI Brand Identity Studio**

A structured, human-in-the-loop logo design pipeline powered by Google Gemini.

</div>

---

SIGIL is not a prompt box that returns a logo. It is a ten-stage design process —
discovery, strategy, creative exploration, curation, refinement, client review,
finalization, delivery — where Gemini widens the option space and does the
labour, and a human makes every creative decision.

The core rule: **the AI never picks the logo.**

---

## The name and the mark

A *sigil* is an inscribed symbol — a mark made to carry meaning. It is the oldest
word for what this application makes.

The mark is a chamfered block **S** set as a seal: three horizontal bars with two
counter-turns, cut at the outer top-left and bottom-right to give the form
direction. It is drawn as real vector geometry in
[`SigilLogo.tsx`](src/components/brand/SigilLogo.tsx) — this application argues
that AI raster output is not a production logo, so its own mark is built the way
it tells its users to build theirs.

Identity: ink `#08080B`, bone `#F2EFE9`, champagne `#DDB876`, with violet
`#8B7BF7` reserved for AI-authored content.

---

## Quick start

```bash
cd sigil
npm install
cp .env.example .env.local     # set GEMINI_API_KEY, SIGIL_AUTH_USERNAME, SIGIL_AUTH_PASSWORD
npm run dev                    # http://localhost:3210
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

On first run, click **Open the Nexora sample** on the dashboard. It arrives
seeded through to approved creative directions, so the very next click runs the
real generation pipeline.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3210 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `node e2e/walkthrough.mjs` | Full pipeline walkthrough against the live API |

---

## Configuration

Everything is set by environment variable and overridable at runtime from
**Settings**. Nothing in the UI hardcodes a model name.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(required)* | **Server-only.** Never reaches the browser. |
| `SIGIL_AUTH_USERNAME` | *(required)* | **Server-only.** Sign-in username. |
| `SIGIL_AUTH_PASSWORD` | *(required)* | **Server-only.** Sign-in password. |
| `SIGIL_AUTH_SECRET` | *(empty)* | Optional extra session-signing secret. |
| `NEXT_PUBLIC_GEMINI_TEXT_MODEL` | `gemini-3.8-flash` | Discovery interview |
| `NEXT_PUBLIC_GEMINI_REASONING_MODEL` | `gemini-3.8-flash` | Brief, directions, critique, iteration |
| `NEXT_PUBLIC_GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image` | Exploration batches (Nano Banana 2) |
| `NEXT_PUBLIC_GEMINI_FINALIST_IMAGE_MODEL` | `gemini-3-pro-image` | Lockups and delivery (Nano Banana Pro) |
| `NEXT_PUBLIC_BATCH_CONCURRENCY` | `3` | Parallel image requests |
| `NEXT_PUBLIC_MAX_RETRIES` | `2` | Automatic retries per failed image |
| `NEXT_PUBLIC_DEFAULT_DIRECTIONS` | `8` | Creative territories per round |
| `NEXT_PUBLIC_DEFAULT_CONCEPTS_PER_DIRECTION` | `6` | Concepts per territory |
| `NEXT_PUBLIC_DEFAULT_ITERATIONS` | `4` | Variations per refinement |
| `GEMINI_TIMEOUT_MS` | `180000` | Per-request timeout |

Two models are used deliberately: exploration generates dozens of images where
speed dominates, while lockups and delivery assets are deliverables where
fidelity does.

---

## The workflow

```
DISCOVERY → BRIEF → DIRECTIONS → EXPLORATION → SELECTION
     → REFINEMENT → FINALISTS → CLIENT REVIEW → FINALIZATION → DELIVERY
```

**1 · Discovery** — An adaptive interview, not a form. Six seed questions open
it; Gemini then decides what else it genuinely needs and stops when it has
enough. Answer, skip, or edit any answer at any time.

**2 · Brand Brief** — Discovery synthesised into a strategic document. Every
field is click-to-edit. Nothing downstream runs until you approve it.

**3 · Creative Directions** — Six to ten *fundamentally different* creative
territories. No artwork yet. Approve, reject, favourite, edit, or comment on
each. **Rejections become permanent constraints** that steer every later
generation.

**4 · Logo Exploration** — One click generates the whole batch. Concepts are
first designed *in language* (which is where conceptual diversity can actually be
reasoned about), then rendered. Live per-item progress, pause, cancel, resume,
and per-item retry.

**5 · Concept Selection** — Human curation. Favourite, shortlist, reject, rate,
comment, multi-select, and compare 2–5 concepts side by side. Rejected work is
never deleted.

**6 · Refinement** — Say *"keep the symbol but make it more premium"*. Gemini
converts that into structured `preserve` / `change` / `remove` / `explore`
instructions **which you confirm and can edit** before anything is generated.
Every variation keeps its parent link, so the version tree stays intact.

**7 · Finalists** — Two to four concepts, each built out into symbol, wordmark,
horizontal, stacked, monochrome, reversed, and small-size lockups. Reproduction,
not redesign: the parent image is sent as a visual reference and the instructions
lock the geometry.

**8 · Client Review** — A separate, light, gallery-like presentation. The client
sees the work and the thinking. They never see prompts, rejected concepts,
ratings, critiques, model names, or your private notes.

**9 · Client Feedback** — *"Too aggressive, the font feels too technical"* becomes
structured requirements, with genuine ambiguities flagged rather than guessed.
**You approve the interpretation before anything is generated from it.**

**10 · Finalization & Delivery** — Three separate approvals (yours, the
client's, final), then the full logo system, a brand kit, and exports.

---

## Architecture

```
src/
  app/                      Routes
    api/gemini/             Server-only Gemini proxy (text · image · vision · status)
    projects/[id]/          The ten stages + history
    present/[id]/           Client presentation (light theme)
    brandkit/[id]/          Printable brand kit
    settings/
  components/               UI primitives, brand mark, artwork surfaces
  features/                 One folder per stage + shared concept library
  services/
    gemini/                 transport · typed service · schemas · config · errors
    db/                     IndexedDB + repository abstraction
  prompts/                  All prompts, composed from structured data
  workflows/                Stages, batch runner, generation, mutations
  types/                    The domain model
```

**Four rules the codebase holds to:**

1. **No component ever builds a prompt.** Everything lives in `src/prompts/`,
   composed from typed project data.
2. **No component ever calls Gemini.** They call typed functions in
   [`services/gemini`](src/services/gemini/index.ts) —
   `generateBrandQuestions()`, `createBrandBrief()`,
   `generateCreativeDirections()`, `generateLogoConcepts()`,
   `generateLogoImage()`, `critiqueLogoConcept()`, `generateLogoIterations()`,
   `analyzeClientFeedback()`, `generateFinalizationInstructions()`,
   `generateBrandKit()`.
3. **No component touches IndexedDB.** They go through `ProjectRepository`.
4. **Every structured call is schema-constrained and validated** before it
   reaches the domain model.

### The image prompt engine

Every image request in the application is built by one function —
[`buildImagePrompt()`](src/prompts/logoExploration.ts) — from the brief, the
creative direction, the concept objective, accumulated feedback memory,
iteration instructions, and a fixed set of craft rules that steer hard away from
mockups, 3D renders, gradients, stock-logo tropes, and decorative backgrounds.

### Feedback memory

Positive and negative constraints accumulate from rejections, your notes, and
client feedback, and are injected into every subsequent generation. They are
visible and switchable in the left rail — you control what the AI remembers.

### Swapping the storage backend

[`ProjectRepository`](src/services/db/repository.ts) is a plain interface with
one IndexedDB implementation. Writing a Supabase or Postgres implementation
means satisfying that interface — no component changes.

---

## Security model

- `GEMINI_API_KEY` has **no** `NEXT_PUBLIC_` prefix, so it is never bundled into
  client JavaScript.
- Browser code talks only to `/api/gemini/*`. It never reaches
  `generativelanguage.googleapis.com` directly.
- The key travels to Google in an `x-goog-api-key` **header**, never a URL, so it
  cannot leak into proxy logs or error strings that echo a request URL.
- Every error message passes through `redact()`, which strips key-shaped strings
  before they reach a log or the browser.
- Client information reaches Gemini only inside the prompts needed to do the
  design work.
- **If you enable a browser-stored key in Settings**, it is held in
  `localStorage` and is readable by anything running on that origin. It is
  offered for convenience when trying the app; the environment key is the
  correct production setup.
- `.env.local` is gitignored. `.env.example` contains no secrets.

- **Every page and API route requires sign-in.** [`src/proxy.ts`](src/proxy.ts)
  checks a session cookie on each request and redirects to `/login` (or returns
  `401` for `/api/*`). The only open routes are `/login`, `/api/auth/*`, and
  `GET /api/gemini/status`, which the container healthcheck uses and which
  reports only whether a server key exists.
- Credentials come from `SIGIL_AUTH_USERNAME` / `SIGIL_AUTH_PASSWORD`. If either
  is unset, sign-in is refused and the app stays locked (fails closed).
- The session is a 12-hour `HttpOnly`, `SameSite=Lax` cookie (`Secure` over
  HTTPS), HMAC-signed with a key derived from the credentials and
  `SIGIL_AUTH_SECRET`. Changing the password or the secret signs everyone out.
- Failed sign-ins are delayed in the app and rate-limited to 5/min per IP in nginx.
- This is a single shared operator login, not per-user accounts or quotas.

---

## Known limitations

These are real, and the application states them in the UI rather than hiding
them.

**1 · Generated assets are raster, not vector.** Gemini's image models return
PNG/JPEG. SIGIL does not claim otherwise: the brand kit carries an explicit
asset disclosure, every exported ZIP ships a `README.txt` saying the same, and
the finalization stage repeats it. Before rollout, the approved mark must be
redrawn as true vector from these references. Auto-tracing a raster logo produces
messy paths and false confidence, so SIGIL deliberately does not do it.

**2 · Text inside generated images is not trustworthy.** Image models corrupt
letterforms. Every concept therefore carries a separate typography record: the
authoritative company name you typed, a verified/unverified flag, and real
typeface recommendations for rebuilding the wordmark properly. The finalists
stage warns you if you are about to present an unverified wordmark.

**3 · The client link is local-first.** Projects live in IndexedDB, so
`/present/[id]` serves the live presentation from the browser it was created in.
Sending the link to a client on another machine requires a backend — which is
what the repository abstraction exists for. Until then, present over a screen
share, or export the presentation as PDF.

**4 · PDF export goes through the browser.** The presentation and brand kit are
laid out as real print documents and printed via the browser's own PDF engine.
This gives vector text at full resolution — better output than a client-side PDF
library — but it is a "Save as PDF" dialog rather than a direct download.

**5 · Lockup consistency is good, not perfect.** Lockups are generated by sending
the approved artwork back as a reference image with instructions that lock the
geometry. Image models still drift slightly. Every lockup is individually
regenerable, and the drift is the same reason point 1 matters.

---

## Testing

`e2e/walkthrough.mjs` drives the entire pipeline in a real browser against the
live Gemini API — no mocks, no fixtures. Sixteen stages:

| # | Stage | What it proves |
| --- | --- | --- |
| 1–2 | Dashboard, seeded stages | Projects open; completed stages stay navigable |
| 3 | Batch generation | Planning + real image generation, live progress |
| 4 | Hard reload | Concepts and artwork survive a refresh |
| 5 | Curation + critique | Vision-grounded critique; true B/W canvas render |
| 6–7 | Iteration engine, version tree | Feedback → structured instructions → lineage |
| 8 | Finalists | Seven-lockup family built from the approved mark |
| 9–10 | Publish, presentation | **Asserts no internal data leaks to the client** |
| 11 | Feedback interpretation | Client prose → design requirements → design memory |
| 12 | Approvals + logo system | Three distinct approvals; full asset system |
| 13 | Delivery | Brand kit with a real palette; printable document |
| 14 | History | Every decision recorded |
| 15 | Invalid key | Understandable error, not a stack trace |
| 16 | Tablet layout | No horizontal overflow at 834px |

```bash
npm run build && npm start   # in one terminal
node e2e/walkthrough.mjs     # in another
```

The run is **resumable**: it uses a persistent browser profile at `e2e/.profile`,
so a second run reuses artwork that has already been generated rather than
re-spending API quota. Delete that directory for a genuinely cold run.
Screenshots land in `e2e/shots/`. Both paths are gitignored.

Last verified run: **all 16 stages passed with zero console errors** against a
production build, using `gemini-3.8-flash` for reasoning, `gemini-3.1-flash-image`
for exploration, and `gemini-3-pro-image` for lockups and delivery assets.

---

## Optional next steps

- A backend (Supabase/Postgres + object storage) to make client links shareable
  and enable real multi-user review.
- Per-user accounts and quotas in place of the single operator login.
- Vector handoff: export the approved mark into an SVG scaffold with correct
  clear-space and a properly set wordmark for a designer to finish.
- Wordmark reconstruction in-app, compositing the verified symbol with live
  webfont text so the delivered wordmark is genuinely correct.
- Mockup generation as an explicit, opt-in stage, separate from concept work.
