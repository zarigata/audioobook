# AudiooBook — Client-Side Audiobook Generator

## TL;DR
> **Summary**: A simple, Portuguese-only web app hosted on GitHub Pages that lets friends upload PDF/EPUB/TXT/DOCX files and convert them into listenable audiobooks using browser-based TTS — no server, no API keys, everything runs locally.
> **Deliverables**: Deployed GitHub Pages site with file upload, dual TTS modes (fast browser voices + quality neural model), in-browser playback, and MP3/WAV download.
> **Effort**: Medium (3-5 days of agent execution)
> **Parallel**: YES - 4 waves
> **Critical Path**: Study Cabeda → Project Setup → TTS Engine → Audio Export → UI → Deploy

## Context
### Original Request
User wants a web page for friends to upload PDFs and text files, transform them into audiobooks using the browser's CPU/memory, and listen while doing other stuff. Must be hosted on GitHub Pages, easy to start. Main TTS language: Portuguese (Brazilian).

### Interview Summary
- **Scale**: 1-2 users max per book — tiny, no perf concerns
- **Language**: Brazilian Portuguese (pt-BR) voices, Portuguese-only UI
- **TTS modes**: Both fast (browser built-in) and quality (neural model)
- **Output**: Play in browser + download as MP3/WAV
- **Approach**: Hybrid — study Cabeda/audiobook-generator architecture, then build a simplified version
- **Features**: Keep it dead simple — upload → listen → download. No bookmarks, no sleep timer, no PWA, no accounts
- **Framework**: Vanilla JS + Vite (simplest possible, borrow patterns from Cabeda's Svelte architecture)

### Research Findings
- **Cabeda/audiobook-generator**: Svelte 5 + ONNX Runtime Web, MIT license. Full pipeline: EPUB/PDF/HTML/TXT → MP3/M4B/WAV. Supports Kokoro-82M + Piper + Web Speech API. Live at audio-gen.cabeda.dev
- **Kokoro-82M**: 82MB neural TTS model, 27 voices, runs via ONNX Runtime Web (WASM + WebGPU). Best quality/size ratio. Proven on GitHub Pages.
- **Piper TTS**: WASM-based, 904 voices including Portuguese. npm package: @mintplex-labs/piper-tts-web
- **Web Speech API**: Zero download, instant playback, Portuguese voices built into Chrome/Firefox. Cannot export audio directly — must use MediaRecorder workaround OR use Kokoro/Piper for export.
- **PDF.js** (pdfjs-dist): ~300KB gzipped, full Portuguese/Unicode support, Web Worker based
- **epubjs**: ~150KB gzipped, EPUB → text via section iteration
- **Mammoth.js**: ~72KB gzipped, DOCX → raw text, UTF-8 output
- **@breezystack/lamejs**: Client-side MP3 encoding, ~460KB, used by Dify/Moodle/Odoo
- **GitHub Pages**: 1GB site limit, 100MB per-file limit, 100GB/month bandwidth. WASM confirmed working. COOP/COEP headers needed for SharedArrayBuffer — injected via Service Worker.
- **Model hosting**: Load from HuggingFace CDN on demand, cache in OPFS (Origin Private File System)

### Guardrails (from gap analysis)
- **GRD-1**: Do NOT attempt to record Web Speech API output for MP3 export — it's unreliable cross-browser. Export only works with Kokoro/Piper (which produce PCM directly). For fast mode, playback is browser-only, no download.
- **GRD-2**: COOP/COEP Service Worker must be registered BEFORE any WASM loading. Test this early.
- **GRD-3**: Limit text processing to Web Workers to avoid blocking the UI thread during PDF parsing and TTS inference.
- **GRD-4**: Memory guard — warn and reject files over 100MB. Process PDFs in page batches of 10. Free resources between batches.
- **GRD-5**: Portuguese text segmentation must handle abbreviations (Sr., Sra., Dr., etc.) and not split on them.
- **GRD-6**: All UI strings in Portuguese. No English text anywhere in the interface.
- **GRD-7**: Model download must show clear progress. Users on slow connections need feedback during the ~82MB Kokoro download.

## Work Objectives
### Core Objective
Build and deploy a single-page web app on GitHub Pages that converts uploaded documents into audiobooks using client-side TTS, entirely in Portuguese, with a dead-simple upload → listen → download workflow.

### Deliverables
1. Working GitHub Pages site (username.github.io/audioobook or custom domain)
2. File upload supporting PDF, EPUB, TXT, DOCX, HTML, RTF
3. Fast TTS mode (Web Speech API — instant, no download)
4. Quality TTS mode (Kokoro-82M via ONNX — requires model download)
5. In-browser audio player (play/pause/stop/seek/speed)
6. MP3 download for quality mode output
7. Portuguese-only UI with drag-and-drop file upload

### Definition of Done (verifiable conditions)
```bash
# Site is live and accessible
curl -s -o /dev/null -w "%{http_code}" https://<username>.github.io/audioobook/
# Returns 200

# All file formats parse correctly
# Agent uploads sample files and verifies text extraction

# TTS generates audible Portuguese speech for both modes
# Agent verifies audio plays for at least 30 seconds

# MP3 download produces a valid audio file
# Agent downloads file and verifies it's playable MP3 > 0 bytes

# No English text visible in the UI
# Agent takes screenshot and verifies all labels are Portuguese
```

### Must Have
- File upload with drag-and-drop
- PDF, EPUB, TXT, DOCX parsing
- Dual TTS modes (fast + quality)
- In-browser playback with basic controls (play/pause, seek, speed)
- MP3 file download (quality mode only)
- Portuguese-only UI
- GitHub Pages deployment via GitHub Actions
- Model download progress indicator

### Must NOT Have (guardrails)
- No server-side processing — everything in the browser
- No API keys or external paid services
- No user accounts or authentication
- No bookmarks, sleep timer, or chapter navigation
- No offline PWA / Service Worker caching (only COOP/COEP SW)
- No dark mode toggle or theme system
- No English text anywhere in the UI
- No file size > 100MB (reject with friendly Portuguese message)

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after (unit tests for parsing/segmentation, browser QA for TTS/playback)
- QA policy: Every task has agent-executed scenarios
- Evidence: .sisyphus/evidence/task-{N}-{slug}.{ext}
- Framework: Vitest for unit tests, Playwright for browser QA

## Execution Strategy
### Parallel Execution Waves

**Wave 1: Foundation (study + scaffolding + deploy pipeline)**
- T1: Clone & study Cabeda/audiobook-generator architecture — extract patterns for ONNX, text segmentation, audio pipeline
- T2: Scaffold Vite + vanilla JS project with file structure
- T3: GitHub Actions workflow for GitHub Pages deployment

**Wave 2: Core Pipeline (parsing + segmentation + Service Worker)**
- T4: File upload UI + format detection + drag-and-drop
- T5: Document parsers — PDF.js, epubjs, mammoth, TXT/HTML/RTF
- T6: Portuguese text segmentation (sentence splitting)
- T7: Service Worker for COOP/COEP headers

**Wave 3: TTS + Audio**
- T8: Fast mode — Web Speech API integration with voice selection
- T9: Quality mode — ONNX Runtime Web + Kokoro-82M model loading from HuggingFace
- T10: Web Worker wrapper for TTS processing (off main thread)
- T11: Progressive audio playback with HTML5 Audio API
- T12: Audio export — PCM concatenation + lamejs MP3 encoding + file download

**Wave 4: UI Polish + Final**
- T13: Complete Portuguese UI — player controls, progress indicators, status messages
- T14: Integration testing with real Portuguese PDF/EPUB/TXT files

### Dependency Matrix
```
T1 (study) → T5, T6, T9, T10, T11, T12 (informs architecture)
T2 (scaffold) → T4, T5, T7, T8, T9, T13 (all build tasks)
T3 (deploy) → standalone (can run in parallel)
T4 (upload) → T5 (parsers need upload to exist)
T5 (parsers) → T6 (segmentation needs parsed text)
T6 (segmentation) → T8, T9 (TTS needs segmented sentences)
T7 (SW) → T9 (ONNX needs COOP/COEP)
T8 (fast TTS) → T11 (playback)
T9 (quality TTS) → T10 (Web Worker), T11 (playback), T12 (export)
T10 (Web Worker) → T9 (wraps quality TTS)
T11 (playback) → T13 (UI controls)
T12 (export) → T13 (download button)
T13 (UI) → T14 (integration test)
T14 (integration) → Final Verification
```

### Agent Dispatch Summary
| Wave | Tasks | Categories |
|------|-------|------------|
| 1 | T1, T2, T3 | deep, quick, quick |
| 2 | T4, T5, T6, T7 | quick, unspecified-high, unspecified-high, quick |
| 3 | T8, T9, T10, T11, T12 | unspecified-high, deep, unspecified-high, unspecified-high, unspecified-high |
| 4 | T13, T14 | unspecified-high, unspecified-high |

## TODOs

- [ ] 1. Study Cabeda/Audiobook-Generator Architecture

  **What to do**:
  1. Clone `https://github.com/Cabeda/audiobook-generator` to `/tmp/cabeda-study`
  2. Read the full source tree structure — understand the module organization
  3. Document these specific patterns in a study notes file (`/tmp/cabeda-study/NOTES.md`):
     - **ONNX Runtime Web initialization**: How do they load Kokoro model? What's the WASM setup? How is WebGPU detected?
     - **Text segmentation**: How do they split text into sentences? What's the regex/parser? Do they handle Portuguese abbreviations?
     - **Progressive playback**: How do they play audio segments while still generating? What's the queue/buffer pattern?
     - **Audio export**: How do they concatenate PCM segments and encode to MP3/M4B?
     - **Web Worker usage**: How is TTS inference offloaded from the main thread?
     - **Model loading from HuggingFace**: What's the download + OPFS caching pattern?
  4. Extract and save key code snippets for each pattern in the notes file
  5. The notes file will be referenced by all subsequent tasks

  **Must NOT do**: Do NOT copy-paste code directly. Extract patterns and architecture decisions only. We're building our own simpler version.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: Requires thorough code reading and pattern extraction across multiple modules
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: T5, T6, T9, T10, T11, T12 | Blocked By: none

  **References**:
  - Repo: `https://github.com/Cabeda/audiobook-generator` — primary study target
  - Live demo: `https://audio-gen.cabeda.dev` — test the working app to understand UX
  - Related: `https://github.com/grworg/epubplayer` — secondary reference for player patterns
  - Related: `https://github.com/clowerweb/tts-studio` — reference for multi-model TTS on GitHub Pages

  **Acceptance Criteria**:
  - [ ] `/tmp/cabeda-study/NOTES.md` exists with documented patterns for: ONNX init, text segmentation, progressive playback, audio export, Web Worker, model loading
  - [ ] Each pattern has at least 1 code snippet extracted
  - [ ] Portuguese-specific handling (if any) is noted

  **QA Scenarios**:
  ```
  Scenario: Study completeness
    Tool: Bash
    Steps: cat /tmp/cabeda-study/NOTES.md | grep -c "##"
    Expected: At least 6 section headers (one per pattern)
    Evidence: .sisyphus/evidence/task-1-study.md

  Scenario: Key patterns captured
    Tool: Bash
    Steps: grep -i "onnx\|segment\|progressive\|export\|worker\|huggingface\|model" /tmp/cabeda-study/NOTES.md | wc -l
    Expected: At least 20 lines mentioning these key terms
    Evidence: .sisyphus/evidence/task-1-study-check.txt
  ```

  **Commit**: NO | Study phase only, no project files

---

- [ ] 2. Scaffold Vite + Vanilla JS Project

  **What to do**:
  1. Initialize a new Vite project with vanilla JavaScript template in the workspace root (`/mnt/projects-ssd/EMPRESAS/FEVERDREAM/WEBSITES/audioobook`)
  2. Create the following file structure:
     ```
     src/
       main.js          — Entry point, app initialization
       app.js            — Main app state and coordination
       ui/
         upload.js       — File upload + drag-and-drop component
         player.js       — Audio player component
         progress.js     — Progress bars and status indicators
       parsers/
         pdf.js          — PDF.js wrapper
         epub.js         — epubjs wrapper
         docx.js         — Mammoth.js wrapper
         text.js         — TXT/HTML/RTF/MD parser
         index.js        — Format detection + parser routing
       tts/
         browser-tts.js  — Web Speech API integration
         neural-tts.js   — ONNX + Kokoro integration
         worker.js       — Web Worker for TTS processing
       audio/
         encoder.js      — lamejs MP3 encoding
         player.js       — Progressive audio playback
         concat.js       — PCM segment concatenation
       utils/
         segmenter.js    — Portuguese text segmentation
         i18n.js         — Portuguese UI strings
       sw.js             — Service Worker (COOP/COEP) — must be in public/
     public/
       sw.js
       index.html        — Single HTML page with Portuguese UI
     ```
  3. Install dependencies: `pdfjs-dist`, `epubjs`, `mammoth`, `onnxruntime-web`, `@breezystack/lamejs`
  4. Create a minimal `index.html` with:
     - Portuguese `<html lang="pt-BR">`
     - UTF-8 charset meta
     - A simple layout skeleton: header ("AudiooBook"), upload area, player area, footer
     - All labels in Portuguese
  5. Verify `npm run dev` works and shows the skeleton page

  **Must NOT do**:
  - Do NOT install Svelte, React, or any framework
  - Do NOT add CSS frameworks (keep it simple with plain CSS)
  - Do NOT configure TypeScript (vanilla JS only)

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard Vite scaffolding, well-defined structure
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: T4, T5, T7, T8, T9, T13 | Blocked By: none

  **References**:
  - Vite vanilla JS template: `npm create vite@latest -- --template vanilla`
  - pdfjs-dist npm: `https://www.npmjs.com/package/pdfjs-dist`
  - epubjs npm: `https://www.npmjs.com/package/epubjs`
  - mammoth npm: `https://www.npmjs.com/package/mammoth`
  - onnxruntime-web npm: `https://www.npmjs.com/package/onnxruntime-web`
  - @breezystack/lamejs npm: `https://www.npmjs.com/package/@breezystack/lamejs`

  **Acceptance Criteria**:
  - [ ] `package.json` exists with all 5 dependencies listed
  - [ ] `npm run dev` starts without errors
  - [ ] `index.html` has `<html lang="pt-BR">` and UTF-8 meta charset
  - [ ] All `src/` subdirectories exist (ui/, parsers/, tts/, audio/, utils/)
  - [ ] `public/sw.js` exists (can be placeholder)

  **QA Scenarios**:
  ```
  Scenario: Project boots correctly
    Tool: Bash
    Steps: npm run dev &>/dev/null & sleep 3 && curl -s http://localhost:5173 | head -5
    Expected: HTML response containing "AudiooBook" or "<!DOCTYPE html>"
    Evidence: .sisyphus/evidence/task-2-boot.txt

  Scenario: Dependencies installed
    Tool: Bash
    Steps: ls node_modules/pdfjs-dist node_modules/epubjs node_modules/mammoth node_modules/onnxruntime-web node_modules/@breezystack/lamejs -d
    Expected: All 5 directories exist
    Evidence: .sisyphus/evidence/task-2-deps.txt
  ```

  **Commit**: YES | Message: `chore(init): scaffold vite vanilla js project` | Files: all scaffolding files

---

- [ ] 3. GitHub Actions Workflow for GitHub Pages Deployment

  **What to do**:
  1. Create `.github/workflows/deploy.yml` with a GitHub Actions workflow that:
     - Triggers on push to `main` branch
     - Uses `actions/checkout@v4`
     - Uses `actions/setup-node@v4` with Node 20
     - Runs `npm ci`
     - Runs `npm run build`
     - Uses `actions/upload-pages-artifact@v3` to upload `dist/`
     - Uses `actions/deploy-pages@v4` to deploy
     - Sets permissions: `pages: write`, `id-token: write`, `contents: read`
  2. Verify the workflow file is valid YAML

  **Must NOT do**:
  - Do NOT add any test steps yet (tests come later)
  - Do NOT add any manual deployment triggers

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard GitHub Pages deployment workflow, well-documented pattern
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: none (runs after all tasks) | Blocked By: none

  **References**:
  - GitHub Pages Vite guide: `https://vitejs.dev/guide/static-deploy#github-pages`
  - GitHub Actions deploy-pages: `https://github.com/actions/deploy-pages`
  - Note: Set `base: '/audioobook/'` in `vite.config.js` if deploying to `username.github.io/audioobook`

  **Acceptance Criteria**:
  - [ ] `.github/workflows/deploy.yml` exists and is valid YAML
  - [ ] Workflow triggers on push to `main`
  - [ ] Workflow uses Node 20, npm ci, npm run build, upload-pages-artifact, deploy-pages
  - [ ] `vite.config.js` has correct `base` path configured

  **QA Scenarios**:
  ```
  Scenario: Valid YAML
    Tool: Bash
    Steps: python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
    Expected: No error, exits 0
    Evidence: .sisyphus/evidence/task-3-yaml.txt

  Scenario: Build produces output
    Tool: Bash
    Steps: npm run build && ls dist/ | head -5
    Expected: dist/ directory contains index.html and assets/
    Evidence: .sisyphus/evidence/task-3-build.txt
  ```

  **Commit**: YES | Message: `ci(infra): add github pages deployment workflow` | Files: `.github/workflows/deploy.yml`, `vite.config.js`

---

- [ ] 4. File Upload UI + Format Detection + Drag-and-Drop

  **What to do**:
  1. Build `src/ui/upload.js` with:
     - Drag-and-drop zone (large centered area, Portuguese instructions: "Arraste seu arquivo aqui ou clique para selecionar")
     - Hidden `<input type="file">` triggered by click on drop zone
     - Accept attribute: `.pdf,.epub,.txt,.docx,.html,.htm,.rtf,.md`
     - File size validation: reject > 100MB with Portuguese message "Arquivo muito grande. O limite é 100MB."
     - Format detection from file extension (not MIME type — unreliable)
     - Visual feedback: drop zone highlights on dragover, shows file name after selection
     - Emits a custom event `file-selected` with `{ file, format, name, size }`
  2. Style the drop zone in plain CSS: dashed border, hover effect, centered icon/text
  3. All text labels in Portuguese

  **Must NOT do**:
  - Do NOT process the file yet — just detect and validate
  - Do NOT use any CSS framework

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Single component, clear spec, straightforward DOM manipulation
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T5 | Blocked By: T2

  **References**:
  - HTML Drag and Drop API: `https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API`
  - File API: `https://developer.mozilla.org/en-US/docs/Web/API/File_API`
  - Pattern: `src/ui/upload.js` — vanilla JS module, exports `initUpload(containerEl)`

  **Acceptance Criteria**:
  - [ ] Drop zone renders with Portuguese text
  - [ ] Dragging a file over shows visual highlight
  - [ ] Selecting a file triggers `file-selected` event with correct format detection
  - [ ] Files > 100MB show Portuguese error message
  - [ ] Unsupported formats show Portuguese error message

  **QA Scenarios**:
  ```
  Scenario: File upload works
    Tool: Playwright
    Steps: Navigate to localhost:5173, drop a test PDF onto the drop zone
    Expected: File name appears, "file-selected" event fires, format detected as "pdf"
    Evidence: .sisyphus/evidence/task-4-upload.png

  Scenario: Large file rejection
    Tool: Playwright
    Steps: Create a 101MB test file, attempt to upload it
    Expected: Portuguese error message "Arquivo muito grande" visible
    Evidence: .sisyphus/evidence/task-4-rejection.png
  ```

  **Commit**: YES | Message: `feat(ui): file upload with drag-and-drop and format detection` | Files: `src/ui/upload.js`, `src/styles/upload.css`, `index.html` update

---

- [ ] 5. Document Parsers — PDF, EPUB, DOCX, TXT, HTML, RTF

  **What to do**:
  1. Build `src/parsers/index.js` — format detection router:
     ```javascript
     export function getParser(format) {
       // Returns the correct parser function for the format
     }
     export async function parseDocument(file, format) {
       // Routes to correct parser, returns { text, title, pageCount }
     }
     ```
  2. Build `src/parsers/pdf.js` — PDF.js wrapper:
     - Load PDF from ArrayBuffer via `pdfjsLib.getDocument({ data })`
     - Set worker source to CDN: `https://cdn.jsdelivr.net/npm/pdfjs-dist@5/build/pdf.worker.min.mjs`
     - Extract text page by page using `page.getTextContent()`
     - Process in batches of 10 pages to avoid memory spikes
     - Call `page.cleanup()` after each batch
     - Return `{ text, title: filename, pageCount: pdf.numPages }`
     - Report progress via callback: `{ current: N, total: numPages }`
  3. Build `src/parsers/epub.js` — epubjs wrapper:
     - Load EPUB from ArrayBuffer
     - Iterate `book.spine.spineItems`, load each, extract `document.textContent`
     - Call `item.unload()` after each section to free memory
     - Extract chapter titles from TOC if available
     - Return `{ text, title: bookTitle, pageCount: spineItems.length }`
  4. Build `src/parsers/docx.js` — Mammoth wrapper:
     - Use `mammoth.extractRawText({ arrayBuffer })` for plain text
     - Return `{ text, title: filename, pageCount: paragraphs count }`
  5. Build `src/parsers/text.js` — TXT/HTML/RTF/MD:
     - TXT: `file.text()` with fallback `TextDecoder('iso-8859-1')` for legacy Portuguese files
     - HTML: `DOMParser` → remove script/style → `body.textContent`
     - RTF: Regex-based parser (strip commands, decode hex chars, handle \par)
     - MD: Strip markdown syntax (headers, bold, links, lists)
  6. Write unit tests in `src/__tests__/parsers.test.js` for each format using Vitest

  **Must NOT do**:
  - Do NOT render EPUB visually — only extract text
  - Do NOT preserve formatting — we need plain text for TTS
  - Do NOT use streaming/chunking for files under 50MB (direct ArrayBuffer is fine)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Multiple parsers to implement, moderate complexity, but each is straightforward
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T6 | Blocked By: T2

  **References**:
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check how Cabeda handles each format
  - PDF.js text extraction: `https://github.com/mozilla/pdf.js/blob/master/docs/contents/examples/index.md`
  - epubjs section loading: `https://github.com/futurepress/epub.js/blob/master/src/section.js`
  - Mammoth browser usage: `https://github.com/mwilliamson/mammoth.js#usage-in-the-browser`
  - RTF regex pattern: `https://github.com/PianothShaveck/LLM_Playground/blob/main/s.js#L706-L713`

  **Acceptance Criteria**:
  - [ ] All 6 formats parse correctly with Portuguese text (ã, ç, é, ê, etc.)
  - [ ] PDF parsing processes in batches of 10 pages with progress callback
  - [ ] EPUB sections are loaded and unloaded individually
  - [ ] Unit tests pass for each format with sample files
  - [ ] `parseDocument()` returns consistent `{ text, title, pageCount }` structure

  **QA Scenarios**:
  ```
  Scenario: PDF parsing with Portuguese text
    Tool: Bash (Vitest)
    Steps: Create test PDF with "Olá mundo! Teste de acentuação: coração, café, pão." Run parser test.
    Expected: Extracted text contains "coração", "café", "pão" with correct accents
    Evidence: .sisyphus/evidence/task-5-pdf.txt

  Scenario: EPUB parsing
    Tool: Bash (Vitest)
    Steps: Parse a sample EPUB file, verify text extraction
    Expected: Returns non-empty text with correct chapter content
    Evidence: .sisyphus/evidence/task-5-epub.txt

  Scenario: Large PDF memory management
    Tool: Bash (Vitest)
    Steps: Mock a 50-page PDF, parse it, verify page cleanup is called
    Expected: page.cleanup() called after each batch, no memory leak warnings
    Evidence: .sisyphus/evidence/task-5-memory.txt
  ```

  **Commit**: YES | Message: `feat(parser): document parsers for PDF, EPUB, DOCX, TXT, HTML, RTF` | Files: `src/parsers/*.js`, `src/__tests__/parsers.test.js`

---

- [ ] 6. Portuguese Text Segmentation

  **What to do**:
  1. Build `src/utils/segmenter.js` with a `segmentText(text, options)` function that:
     - Splits Portuguese text into sentences for TTS processing
     - Handles Portuguese abbreviations that should NOT trigger splits: Sr., Sra., Dr., Prof., etc.
     - Handles Portuguese number formats: 1.000 (thousand) vs 1.5 (decimal) — the period in "1.000" should not split
     - Handles ellipsis (...) and em-dashes
     - Handles dialogue markers (—, " ", ' ')
     - Optional `maxLength` parameter (default: 200 chars) — merge short sentences up to this length for efficiency
     - Returns array of sentence strings
  2. Also build a `splitIntoChunks(text, chunkSize)` function for very long texts:
     - Splits at sentence boundaries, never mid-word
     - Each chunk ≤ chunkSize characters
     - Used to feed TTS in manageable pieces
  3. Write unit tests with Portuguese text samples including:
     - Abbreviations: "O Dr. Silva foi à Sra. Maria."
     - Numbers: "O preço é R$ 1.000,50."
     - Dialogue: "— Olá! — disse ela. — Como vai?"
     - Mixed: Complex paragraphs with multiple sentence types
  4. Reference Cabeda's segmentation approach from study notes

  **Must NOT do**:
  - Do NOT use NLP libraries — regex-based is sufficient for TTS
  - Do NOT try to detect semantic meaning — just split at sentence boundaries

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Requires careful regex work with Portuguese-specific rules
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T8, T9 | Blocked By: T2

  **References**:
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check Cabeda's text segmentation section
  - Portuguese abbreviations list: Sr., Sra., Srta., Dr., Dra., Prof., Profa., Eng., Arq., etc.
  - Portuguese number format: `R$ 1.234,56` (period = thousands, comma = decimal)
  - Pattern: `src/utils/segmenter.js` — pure function, no DOM dependency

  **Acceptance Criteria**:
  - [ ] `segmentText()` splits "O Dr. Silva foi embora. Ele voltou amanhã." into exactly 2 sentences
  - [ ] Abbreviations do NOT cause false splits
  - [ ] Numbers like "1.000" do NOT cause false splits
  - [ ] Unit tests pass with at least 5 Portuguese text samples
  - [ ] `splitIntoChunks()` respects sentence boundaries

  **QA Scenarios**:
  ```
  Scenario: Abbreviation handling
    Tool: Bash (Vitest)
    Steps: segmentText("O Dr. Silva conversou com a Sra. Maria. Eles foram ao cinema.")
    Expected: Returns ["O Dr. Silva conversou com a Sra. Maria.", "Eles foram ao cinema."]
    Evidence: .sisyphus/evidence/task-6-abbrev.txt

  Scenario: Number format handling
    Tool: Bash (Vitest)
    Steps: segmentText("O preço é R$ 1.000,50. Ficou caro.")
    Expected: Returns ["O preço é R$ 1.000,50.", "Ficou caro."]
    Evidence: .sisyphus/evidence/task-6-numbers.txt

  Scenario: Empty/edge cases
    Tool: Bash (Vitest)
    Steps: segmentText(""), segmentText("Uma frase sem ponto final")
    Expected: Returns [] and ["Uma frase sem ponto final"]
    Evidence: .sisyphus/evidence/task-6-edge.txt
  ```

  **Commit**: YES | Message: `feat(parser): portuguese text segmentation with abbreviation handling` | Files: `src/utils/segmenter.js`, `src/__tests__/segmenter.test.js`

---

- [ ] 7. Service Worker for COOP/COEP Headers

  **What to do**:
  1. Build `public/sw.js` — a Service Worker that:
     - Intercepts all responses and adds headers:
       - `Cross-Origin-Opener-Policy: same-origin`
       - `Cross-Origin-Embedder-Policy: require-corp`
     - This enables `SharedArrayBuffer` which ONNX Runtime needs for multi-threaded WASM
  2. Register the SW in `src/main.js`:
     ```javascript
     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.register('/sw.js');
     }
     ```
  3. Add `Cross-Origin-Resource-Policy: cross-origin` to assets served from HuggingFace CDN
  4. Handle SW lifecycle: wait for activation before starting app

  **Must NOT do**:
  - Do NOT add offline caching or PWA features — this SW is ONLY for COOP/COEP headers
  - Do NOT cache any assets or models in the SW

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Small, well-defined Service Worker with clear pattern
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T9 | Blocked By: T2

  **References**:
  - COOP/COEP SW pattern: `https://github.com/nicosignorella/binance-arbitrage-monitoring/blob/main/public/sw.js`
  - SharedArrayBuffer requirement: `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer`
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check how Cabeda handles this

  **Acceptance Criteria**:
  - [ ] `public/sw.js` exists and adds COOP/COEP headers to all responses
  - [ ] SW is registered in `src/main.js`
  - [ ] After page load, `crossOriginIsolated` is `true` in console
  - [ ] `SharedArrayBuffer` is available (not undefined)

  **QA Scenarios**:
  ```
  Scenario: Cross-origin isolation works
    Tool: Playwright
    Steps: Navigate to localhost:5173, evaluate `window.crossOriginIsolated`
    Expected: Returns true
    Evidence: .sisyphus/evidence/task-7-coop.txt

  Scenario: SharedArrayBuffer available
    Tool: Playwright
    Steps: Navigate to localhost:5173, evaluate `typeof SharedArrayBuffer`
    Expected: Returns "function"
    Evidence: .sisyphus/evidence/task-7-sab.txt
  ```

  **Commit**: YES | Message: `feat(infra): service worker for COOP/COEP headers` | Files: `public/sw.js`, `src/main.js`

---

- [ ] 8. Fast Mode — Web Speech API Integration

  **What to do**:
  1. Build `src/tts/browser-tts.js` that wraps the Web Speech API:
     ```javascript
     export class BrowserTTS {
       constructor(options = {}) { /* voice, rate, pitch, lang */ }
       async getVoices(lang = 'pt-BR') { /* filter voices by language */ }
       async speak(text) { /* speak single sentence, return promise that resolves on end */ }
       async speakAll(sentences, onProgress) { /* speak sentence by sentence with progress */ }
       pause() { /* pause speech */ }
       resume() { /* resume speech */ }
       stop() { /* stop speech completely */ }
     }
     ```
  2. Filter for Portuguese voices: `voice.lang.startsWith('pt-BR')` or `voice.lang.startsWith('pt')`
  3. Provide a voice selector UI that lists available Portuguese voices
  4. Support rate control (0.5x - 2x) for speed adjustment
  5. Emit events: `speaking(sentenceIndex)`, `progress(current/total)`, `complete`, `error`
  6. Handle the Chrome bug where `speechSynthesis` pauses after ~15 seconds of continuous speech — implement a workaround by splitting long text and using `onend` callbacks to chain utterances

  **Must NOT do**:
  - Do NOT attempt to record/export audio from Web Speech API — it's unreliable cross-browser. Fast mode is LISTEN ONLY. (Guardrail GRD-1)
  - Do NOT block the UI while speaking — use event-driven approach

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Requires careful handling of browser quirks (Chrome 15s pause bug, voice loading)
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T11 | Blocked By: T2, T6

  **References**:
  - Web Speech API: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API`
  - SpeechSynthesis: `https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis`
  - Chrome 15s bug workaround: Resume synthesis periodically via `speechSynthesis.pause(); speechSynthesis.resume();`
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check how Cabeda uses Web Speech API

  **Acceptance Criteria**:
  - [ ] `BrowserTTS` class initializes and lists available Portuguese voices
  - [ ] Speaking Portuguese text produces audible output
  - [ ] Pause/resume/stop work correctly
  - [ ] Chrome 15s pause workaround is implemented
  - [ ] `onProgress` callback fires for each sentence

  **QA Scenarios**:
  ```
  Scenario: Portuguese voice detection
    Tool: Playwright
    Steps: Navigate to localhost:5173, create BrowserTTS instance, call getVoices('pt-BR')
    Expected: Returns at least 1 voice with lang starting with 'pt'
    Evidence: .sisyphus/evidence/task-8-voices.txt

  Scenario: Speech synthesis works
    Tool: Playwright
    Steps: Create BrowserTTS, call speak("Olá mundo, este é um teste."), wait for complete event
    Expected: complete event fires within 10 seconds, no errors
    Evidence: .sisyphus/evidence/task-8-speak.txt
  ```

  **Commit**: YES | Message: `feat(tts): web speech api integration with portuguese voice selection` | Files: `src/tts/browser-tts.js`

---

- [ ] 9. Quality Mode — ONNX Runtime Web + Kokoro-82M Model Loading

  **What to do**:
  1. Build `src/tts/neural-tts.js` that:
     - Loads ONNX Runtime Web (`onnxruntime-web`)
     - Downloads Kokoro-82M model from HuggingFace CDN on first use
     - Caches the model in OPFS (Origin Private File System) for subsequent uses
     - Provides progress callback during model download: `{ loaded: bytes, total: bytes, percent: N }`
     - Runs TTS inference to generate PCM audio from text
     - Returns `{ audioData: Float32Array, sampleRate: 24000 }`
  2. Model loading flow:
     ```javascript
     // Check OPFS cache first
     const opfsRoot = await navigator.storage.getDirectory();
     const fileHandle = await opfsRoot.getFileHandle('kokoro-82m.onnx', { create: false });
     // If not cached, download from HuggingFace with progress
     const modelUrl = 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/onnx/model.onnx';
     // Cache to OPFS after download
     ```
  3. ONNX session creation:
     ```javascript
     const session = await ort.InferenceSession.create(modelPath, {
       executionProviders: ['webgpu', 'wasm'], // Prefer WebGPU, fallback to WASM
     });
     ```
  4. Text-to-audio inference (adapt from Cabeda's pattern):
     - Tokenize Portuguese text
     - Run ONNX inference
     - Convert output tensor to Float32Array PCM audio
  5. Handle device capability detection:
     - If WebGPU available → use it (faster)
     - If only WASM → use it (slower but works everywhere)
     - If device memory < 2GB → warn user, suggest fast mode instead

  **Must NOT do**:
  - Do NOT bundle the model in the GitHub Pages deployment (82MB exceeds comfort zone)
  - Do NOT download the model on page load — only when user selects quality mode
  - Do NOT run inference on the main thread (see T10 for Web Worker)

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: Complex integration with ONNX Runtime, model loading, OPFS caching. Requires understanding the Cabeda implementation.
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T10, T11, T12 | Blocked By: T2, T7

  **References**:
  - Study notes: `/tmp/cabeda-study/NOTES.md` — CRITICAL: follow Cabeda's ONNX initialization pattern exactly
  - Kokoro model: `https://huggingface.co/hexgrad/Kokoro-82M`
  - onnxruntime-web API: `https://onnxruntime.ai/docs/tutorials/web/
  - OPFS API: `https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API#origin_private_file_system`
  - Cabeda source: `https://github.com/Cabeda/audiobook-generator` — look at their TTS engine module

  **Acceptance Criteria**:
  - [ ] Model downloads from HuggingFace with progress callback reporting percentage
  - [ ] Model is cached in OPFS and not re-downloaded on second use
  - [ ] ONNX session creates successfully with WebGPU or WASM fallback
  - [ ] TTS inference produces Float32Array PCM audio at 24kHz
  - [ ] Portuguese text generates audible, recognizable speech

  **QA Scenarios**:
  ```
  Scenario: Model download and caching
    Tool: Playwright
    Steps: Navigate to localhost:5173, trigger quality mode, wait for model download, check OPFS
    Expected: Model file exists in OPFS, progress callback fired with >= 90% before completion
    Evidence: .sisyphus/evidence/task-9-model.txt

  Scenario: Portuguese TTS inference
    Tool: Playwright
    Steps: Load model, run inference on "Olá, como vai você?"
    Expected: Returns Float32Array with non-zero values (actual audio data)
    Evidence: .sisyphus/evidence/task-9-inference.txt

  Scenario: WebGPU fallback
    Tool: Playwright
    Steps: Block WebGPU (if possible), verify WASM fallback works
    Expected: Session creates with WASM provider, inference still works
    Evidence: .sisyphus/evidence/task-9-fallback.txt
  ```

  **Commit**: YES | Message: `feat(tts): onnx runtime + kokoro-82m neural tts with opfs caching` | Files: `src/tts/neural-tts.js`

---

- [ ] 10. Web Worker Wrapper for TTS Processing

  **What to do**:
  1. Build `src/tts/worker.js` as a Web Worker that:
     - Receives messages: `{ type: 'init', config }`, `{ type: 'synthesize', text, id }`, `{ type: 'cancel' }`
     - Loads ONNX Runtime and Kokoro model inside the worker (keeps main thread free)
     - Runs inference for each sentence and returns PCM audio
     - Posts back: `{ type: 'audio', id, audioData: Float32Array, sampleRate }`, `{ type: 'progress', current, total }`, `{ type: 'error', message }`
  2. Build `src/tts/worker-manager.js` that manages the worker:
     ```javascript
     export class TTSWorkerManager {
       async init(config) { /* spawn worker, send init message */ }
       async synthesize(text) { /* send text, return promise for audio result */ }
       async synthesizeBatch(sentences, onProgress) { /* process sentences sequentially with progress */ }
       cancel() { /* cancel current processing */ }
       terminate() { /* terminate worker */ }
     }
     ```
  3. Handle worker error cases: model load failure, inference timeout, OOM
  4. Configure Vite to handle Web Worker bundling: `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`

  **Must NOT do**:
  - Do NOT run ONNX inference on the main thread
  - Do NOT create multiple workers (one is enough for our 1-2 user scale)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Web Worker communication pattern with typed array transfer
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T11, T12 | Blocked By: T9

  **References**:
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check Cabeda's Web Worker pattern
  - Vite Web Worker: `https://vitejs.dev/guide/features#web-workers`
  - Web Worker API: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API`
  - Transferable objects: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects`

  **Acceptance Criteria**:
  - [ ] Worker loads ONNX Runtime and Kokoro model without blocking main thread
  - [ ] Synthesize message returns PCM audio data
  - [ ] Progress messages are posted during batch processing
  - [ ] Error cases (model failure, timeout) are handled gracefully
  - [ ] Main thread remains responsive during TTS inference

  **QA Scenarios**:
  ```
  Scenario: Worker processes text
    Tool: Playwright
    Steps: Init TTSWorkerManager, synthesize "Teste de voz.", wait for audio result
    Expected: Returns Float32Array with non-zero audio samples
    Evidence: .sisyphus/evidence/task-10-worker.txt

  Scenario: Main thread responsive during inference
    Tool: Playwright
    Steps: Start batch synthesis of 20 sentences, simultaneously click a button on the page
    Expected: Button click responds within 100ms (main thread not blocked)
    Evidence: .sisyphus/evidence/task-10-responsive.txt
  ```

  **Commit**: YES | Message: `feat(tts): web worker wrapper for neural tts processing` | Files: `src/tts/worker.js`, `src/tts/worker-manager.js`

---

- [ ] 11. Progressive Audio Playback

  **What to do**:
  1. Build `src/audio/player.js` with a progressive audio player:
     ```javascript
     export class AudioPlayer {
       constructor() { /* setup AudioContext */ }
       async playSegment(audioData, sampleRate) { /* play a single PCM segment */ }
       async enqueueSegment(audioData, sampleRate) { /* add to play queue */ }
       pause() { /* pause playback */ }
       resume() { /* resume playback */ }
       stop() { /* stop and clear queue */ }
       setSpeed(rate) { /* playback speed 0.5x - 3x */ }
       seekToTime(seconds) { /* seek to position */ }
       getDuration() { /* total duration of all segments */ }
       getCurrentTime() { /* current playback position */ }
       onTimeUpdate(callback) { /* periodic position updates */ }
       onComplete(callback) { /* fired when all segments played */ }
     }
     ```
  2. Progressive playback pattern:
     - Maintain a queue of PCM audio segments
     - Play segments sequentially as they're generated by TTS
     - Don't wait for full book — start playing as soon as first segment is ready
     - Concatenate segments on-the-fly for seamless playback
  3. Build `src/audio/concat.js` for PCM concatenation:
     - Concatenate Float32Array segments into a single buffer
     - Add small crossfade (5ms) between segments to avoid clicks
     - Handle different sample rates (resample if needed)
  4. Use Web Audio API for playback:
     - `AudioContext` → `AudioBufferSourceNode` → `destination`
     - Support speed control via `playbackRate`

  **Must NOT do**:
  - Do NOT wait for full TTS generation before starting playback
  - Do NOT use HTML5 `<audio>` element for live PCM playback (use Web Audio API)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Audio engineering with Web Audio API, PCM manipulation, progressive buffering
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T13 | Blocked By: T8, T9, T10

  **References**:
  - Study notes: `/tmp/cabeda-study/NOTES.md` — check Cabeda's progressive playback pattern
  - Web Audio API: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API`
  - AudioContext: `https://developer.mozilla.org/en-US/docs/Web/API/AudioContext`
  - PCM concatenation with crossfade: simple Float32Array merge with linear interpolation at boundaries

  **Acceptance Criteria**:
  - [ ] Audio plays segments progressively as they're generated
  - [ ] Pause/resume/stop work correctly
  - [ ] Speed control (0.5x - 3x) works without audio artifacts
  - [ ] No audible clicks between segments (crossfade works)
  - [ ] Time tracking works (current position, total duration)

  **QA Scenarios**:
  ```
  Scenario: Progressive playback
    Tool: Playwright
    Steps: Enqueue 3 audio segments with 1s delay between each, verify playback starts before all segments are ready
    Expected: Playback starts after first segment, continues seamlessly as more segments arrive
    Evidence: .sisyphus/evidence/task-11-progressive.txt

  Scenario: Pause and resume
    Tool: Playwright
    Steps: Start playback, wait 2s, pause, wait 2s, resume
    Expected: Audio continues from where it paused, no restart
    Evidence: .sisyphus/evidence/task-11-pause.txt
  ```

  **Commit**: YES | Message: `feat(audio): progressive audio playback with web audio api` | Files: `src/audio/player.js`, `src/audio/concat.js`

---

- [ ] 12. Audio Export — MP3 Encoding + File Download

  **What to do**:
  1. Build `src/audio/encoder.js` that:
     - Takes Float32Array PCM audio data
     - Encodes to MP3 using `@breezystack/lamejs`
     - Returns a `Blob` of type `audio/mpeg`
     - Reports encoding progress
     ```javascript
     export class AudioEncoder {
       async encodeMP3(audioData, sampleRate, options = {}) { /* returns Blob */ }
       async encodeWAV(audioData, sampleRate) { /* returns Blob */ }
       downloadBlob(blob, filename) { /* trigger browser download */ }
     }
     ```
  2. MP3 encoding with lamejs:
     ```javascript
     import * as lamejs from '@breezystack/lamejs';
     // Convert Float32 [-1,1] to Int16 [-32768, 32767]
     const samples = new Int16Array(audioData.length);
     for (let i = 0; i < audioData.length; i++) {
       samples[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
     }
     const mp3enc = new lamejs.Mp3Encoder(1, sampleRate, 128); // mono, 24kHz, 128kbps
     const buffer = [];
     const blockSize = 1152;
     for (let i = 0; i < samples.length; i += blockSize) {
       const chunk = samples.subarray(i, i + blockSize);
       const mp3buf = mp3enc.encodeBuffer(chunk);
       if (mp3buf.length > 0) buffer.push(mp3buf);
     }
     const end = mp3enc.flush();
     if (end.length > 0) buffer.push(end);
     return new Blob(buffer, { type: 'audio/mp3' });
     ```
  3. WAV encoding (simpler, no library needed):
     - Write RIFF header + PCM data directly
     - Used as fallback or when user wants lossless
  4. Download trigger:
     ```javascript
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);
     ```
  5. Show encoding progress in Portuguese: "Codificando áudio... N%"

  **Must NOT do**:
  - Do NOT attempt to encode Web Speech API output (GRD-1)
  - Do NOT block the UI during encoding — use requestIdleCallback or chunk processing

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Audio encoding with lamejs, binary file manipulation
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T13 | Blocked By: T9, T10

  **References**:
  - lamejs usage: `https://github.com/nicosignorella/binance-arbitrage-monitoring/blob/main/public/sw.js` — just kidding, use `https://www.npmjs.com/package/@breezystack/lamejs`
  - Dify lamejs pattern: `https://github.com/langgenius/dify/blob/main/web/app/components/base/voice-input/utils.ts`
  - WAV format spec: `http://soundfile.sapp.org/doc/WaveFormat/`

  **Acceptance Criteria**:
  - [ ] MP3 encoding produces valid MP3 file that plays in browsers and media players
  - [ ] WAV encoding produces valid WAV file
  - [ ] Download triggers automatically with correct filename
  - [ ] Encoding progress is shown in Portuguese
  - [ ] Float32 → Int16 conversion preserves audio quality

  **QA Scenarios**:
  ```
  Scenario: MP3 encoding works
    Tool: Playwright
    Steps: Generate test PCM audio (sine wave), encode to MP3, check blob size > 0
    Expected: Blob type is 'audio/mp3', size > 0
    Evidence: .sisyphus/evidence/task-12-mp3.txt

  Scenario: MP3 file is valid
    Tool: Bash
    Steps: Download MP3 blob, check file starts with ID3 or sync word (0xFF 0xFB)
    Expected: First bytes match MP3 format signature
    Evidence: .sisyphus/evidence/task-12-valid.txt

  Scenario: WAV encoding works
    Tool: Playwright
    Steps: Generate test PCM, encode to WAV, check blob
    Expected: Blob type is 'audio/wav', starts with 'RIFF' header
    Evidence: .sisyphus/evidence/task-12-wav.txt
  ```

  **Commit**: YES | Message: `feat(audio): mp3 and wav encoding with file download` | Files: `src/audio/encoder.js`

---

- [ ] 13. Complete Portuguese UI — Player Controls, Progress Indicators, Status Messages

  **What to do**:
  1. Build `src/ui/player.js` — audio player controls:
     - Play/Pause button (toggle icon)
     - Stop button
     - Speed control dropdown: 0.5x, 0.75x, 1x (Normal), 1.25x, 1.5x, 2x, 3x
     - Progress bar showing current position / total duration (format: MM:SS / MM:SS)
     - Seekable progress bar (click to jump)
     - All labels in Portuguese
  2. Build `src/ui/progress.js` — progress indicators:
     - File parsing progress: "Processando arquivo... Página N de M"
     - Model download progress: "Baixando modelo de voz... N%"
     - TTS generation progress: "Gerando áudio... Frase N de M"
     - MP3 encoding progress: "Codificando MP3... N%"
     - Overall progress bar for the full pipeline
  3. Build `src/utils/i18n.js` — centralized Portuguese strings:
     ```javascript
     export const strings = {
       appTitle: 'AudiooBook',
       dropZone: 'Arraste seu arquivo aqui ou clique para selecionar',
       supportedFormats: 'PDF, EPUB, TXT, DOCX, HTML, RTF',
       fastMode: 'Modo Rápido (voz do navegador)',
       qualityMode: 'Modo Qualidade (voz neural — requer download)',
       play: 'Reproduzir',
       pause: 'Pausar',
       stop: 'Parar',
       download: 'Baixar MP3',
       speed: 'Velocidade',
       processing: 'Processando...',
       generating: 'Gerando áudio...',
       encoding: 'Codificando...',
       ready: 'Pronto para ouvir',
       error: 'Erro',
       fileSizeError: 'Arquivo muito grande. O limite é 100MB.',
       formatError: 'Formato não suportado.',
       downloadModel: 'Baixar modelo de voz',
       modelDownloading: 'Baixando modelo... N%',
     };
     ```
  4. Build `src/app.js` — main app coordinator:
     - Wire up all components: upload → parser → segmenter → TTS → player → encoder
     - Manage app states: `idle`, `uploading`, `parsing`, `segmenting`, `generating`, `playing`, `encoding`, `done`, `error`
     - Show/hide UI sections based on state
     - Fast mode flow: parse → segment → speak via BrowserTTS
     - Quality mode flow: parse → segment → TTS worker → progressive playback → optional MP3 export
  5. Style everything in plain CSS:
     - Clean, minimal design with good typography
     - Responsive (works on mobile and desktop)
     - Large touch targets for mobile users
     - Colors: warm, approachable (not corporate blue)

  **Must NOT do**:
  - Do NOT use any English text anywhere in the UI (GRD-6)
  - Do NOT add dark mode toggle, bookmarks, sleep timer, or any feature not in scope
  - Do NOT use CSS frameworks or component libraries

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Multiple UI components to build and wire together, moderate CSS work
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: T14 | Blocked By: T8, T9, T10, T11, T12

  **References**:
  - UI inspiration: `https://epubplayer.com` — clean audiobook player UI
  - UI inspiration: `https://audio-gen.cabeda.dev` — Cabeda's interface
  - Simple audio player pattern: basic HTML range input for seek bar, buttons for controls
  - i18n strings: all must match exactly what's defined in `src/utils/i18n.js`

  **Acceptance Criteria**:
  - [ ] All UI text is in Portuguese — zero English visible on the page
  - [ ] Player controls (play/pause/stop/speed) work correctly
  - [ ] Progress indicators show for each stage (parsing, generating, encoding)
  - [ ] App state transitions work: idle → parsing → generating → playing → done
  - [ ] Responsive design works on mobile viewport (375px) and desktop (1440px)

  **QA Scenarios**:
  ```
  Scenario: No English text in UI
    Tool: Playwright
    Steps: Take screenshot of full page, check for common English words ("play", "pause", "stop", "download", "upload", "speed")
    Expected: Zero occurrences of these English words in the visible UI
    Evidence: .sisyphus/evidence/task-13-i18n.png

  Scenario: Full pipeline — fast mode
    Tool: Playwright
    Steps: Upload a small TXT file, select fast mode, click play, wait 10 seconds
    Expected: Speech synthesis starts, progress indicator updates, player shows elapsed time
    Evidence: .sisyphus/evidence/task-13-fast.txt

  Scenario: Mobile responsive
    Tool: Playwright
    Steps: Set viewport to 375x812 (iPhone), take screenshot
    Expected: Upload area and player controls are visible and usable without horizontal scroll
    Evidence: .sisyphus/evidence/task-13-mobile.png
  ```

  **Commit**: YES | Message: `feat(ui): complete portuguese ui with player controls and progress indicators` | Files: `src/ui/player.js`, `src/ui/progress.js`, `src/utils/i18n.js`, `src/app.js`, `src/styles/*.css`

---

- [ ] 14. Integration Testing with Real Portuguese Files

  **What to do**:
  1. Create test files in `tests/fixtures/`:
     - `teste.pdf` — A small PDF with 2-3 pages of Portuguese text
     - `teste.epub` — A small EPUB with Portuguese content
     - `teste.txt` — A plain text file with Portuguese paragraphs (~500 words)
     - `teste.docx` — A DOCX file with Portuguese text
  2. Build end-to-end test scenarios:
     - **Fast mode TXT**: Upload TXT → select fast mode → verify speech synthesis starts
     - **Quality mode TXT**: Upload TXT → select quality mode → wait for model → verify audio plays → download MP3 → verify file valid
     - **PDF parsing**: Upload PDF → verify text extracted correctly with accents
     - **EPUB parsing**: Upload EPUB → verify text extracted correctly
     - **DOCX parsing**: Upload DOCX → verify text extracted correctly
     - **Large file rejection**: Create 101MB file → verify Portuguese error message
  3. Fix any integration issues found during testing
  4. Verify the complete `vite build` produces a working `dist/` folder
  5. Test the built output by serving `dist/` locally

  **Must NOT do**:
  - Do NOT test with copyrighted books — use public domain or self-created test content
  - Do NOT skip testing any file format

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Integration testing across multiple components, bug fixing
  - Skills: `[]` - No special skills needed
  - Omitted: `[]` - N/A

  **Parallelization**: Can Parallel: NO | Wave 4 (final) | Blocks: Final Verification | Blocked By: T13

  **References**:
  - All source files in `src/`
  - All unit tests in `src/__tests_/`
  - Public domain Portuguese texts: Project Gutenberg, Domínio Público Brasil
  - Test PDF creation: use a browser to print a Portuguese HTML page to PDF

  **Acceptance Criteria**:
  - [ ] All 4 file formats parse correctly with Portuguese accents
  - [ ] Fast mode produces audible speech for all formats
  - [ ] Quality mode produces audio + downloadable MP3 for all formats
  - [ ] No JavaScript errors in browser console during normal operation
  - [ ] `npm run build` produces a working `dist/` folder
  - [ ] Large file (100MB+) is rejected with Portuguese error message

  **QA Scenarios**:
  ```
  Scenario: End-to-end quality mode with PDF
    Tool: Playwright
    Steps: Upload teste.pdf, select quality mode, wait for model download, wait for first audio, verify playback starts, click download, verify MP3 file is created
    Expected: All stages complete without errors, MP3 file is > 0 bytes
    Evidence: .sisyphus/evidence/task-14-e2e-pdf.txt

  Scenario: Console error check
    Tool: Playwright
    Steps: Run through full pipeline with TXT file, capture all console messages
    Expected: Zero errors in console (warnings are OK)
    Evidence: .sisyphus/evidence/task-14-console.txt

  Scenario: Build output works
    Tool: Bash + Playwright
    Steps: npm run build, serve dist/ with npx serve, navigate to localhost:3000, run upload + fast mode test
    Expected: Built app works identically to dev server
    Evidence: .sisyphus/evidence/task-14-build.txt
  ```

  **Commit**: YES | Message: `test: integration tests with real portuguese files and bug fixes` | Files: `tests/fixtures/*`, `src/__tests__/integration.test.js`, any bug fixes

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright for browser testing)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Each task commits upon completion
- Commit messages follow conventional commits: `feat(scope): description`
- Scopes: `parser`, `tts`, `audio`, `ui`, `infra`
- Final commit after all tasks: `feat: initial release — AudiooBook client-side audiobook generator`

## Success Criteria
1. Site loads on GitHub Pages and all UI is in Portuguese
2. User can drag-and-drop or select a PDF, EPUB, TXT, or DOCX file
3. Fast mode plays the text aloud immediately using browser voices (Portuguese)
4. Quality mode downloads Kokoro model (with progress), then generates natural speech
5. Quality mode audio can be downloaded as MP3
6. Files over 100MB are rejected with a friendly Portuguese message
7. App works on Chrome, Firefox, and Edge (latest versions)
