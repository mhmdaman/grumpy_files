# 🦆 GrumpyDuck — Phase 3: Interactive Review & Cleanup Planning

> A read-only local file-organisation assistant that tells you the truth about your storage.

GrumpyDuck scans a directory, analyses its contents, interprets file purpose and context, and provides an interactive review session allowing you to curate a cleanup plan — while remaining **strictly read-only** with **zero filesystem modifications**. It is a duck, not a broom.

---

## What's New in Phase 3: Interactive Review & Cleanup Planning

- **Interactive `review` Command (`npm start -- review <path>`)**: Present file recommendations one by one with complete context and clear options (`[K] Keep`, `[C] Mark for cleanup`, `[S] Skip`, `[D] Details`, `[Q] Quit`).
- **Prioritised Review Flow**: Intelligently ranks candidates so the highest-impact items come first:
  1. Redundant Duplicate Copies (`POTENTIAL_CLEANUP`)
  2. Application Installers in Downloads (`REVIEW`)
  3. Large Files under review (`REVIEW`)
  4. Other Old / Context Review candidates
- **Duplicate Group Intelligence**: Identifies primary vs. redundant copies in duplicate groups. Only redundant extra copies are queued as cleanup candidates; the primary retained copy is protected.
- **Deep File Inspection (`[D] Details`)**: Shows complete metadata, confidence scores, observations, modification history, and all duplicate file locations before deciding.
- **In-Memory Session State**: Tracks live progress (`Reviewed: X / Total`, `KEEP`, `Cleanup`, `Skipped`, and cumulative potential cleanup bytes) with zero disk mutations.
- **Cleanup Plan Export (`--export <file>`)**: Generates structured JSON cleanup plans (`{ scanPath, createdAt, readOnly: true, files: [...], totalSelectedBytes }`) for future automation.
- **Protected Paths Layer**: Built-in safety subsystem protecting system-critical roots (`/System`, `/Library`, `/usr`, `/bin`, `/sbin`, `/etc`, `/var`, `/private`) from being targeted for cleanup.
- **Strictly Read-Only Guarantee**: Absolutely no files are deleted, moved, renamed, or modified.

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
  - [`scan <directory>`](#scan-directory)
  - [`review <directory>`](#review-directory)
- [Interactive Keyboard Controls](#interactive-keyboard-controls)
- [Configuration Options](#configuration-options)
- [Intelligence & Recommendation System](#intelligence--recommendation-system)
- [Review Flow Example](#review-flow-example)
- [Cleanup Plan Export Schema](#cleanup-plan-export-schema)
- [Safety Limitations & Protected Paths](#safety-limitations--protected-paths)
- [Project Architecture](#project-architecture)
- [Running Tests](#running-tests)
- [Tauri Integration Guide](#tauri-integration-guide)

---

## Installation

**Requirements**: Node.js 18+ and npm 9+.

```bash
# Clone or enter the project directory
cd grumpyduck

# Install dependencies
npm install

# Build the TypeScript source
npm run build
```

---

## Usage

```bash
# 1. Scan and inspect storage summary
npm start -- scan ~/Downloads

# 2. Interactively review candidates and build a cleanup plan
npm start -- review ~/Downloads

# 3. Interactively review and export the cleanup plan to JSON
npm start -- review ~/Downloads --export cleanup-plan.json

# 4. Generate raw scan JSON report
npm start -- scan ~/Downloads --json
```

---

## CLI Commands

### `scan <directory>`

Scan a directory and generate a file-organisation report.

```bash
grumpyduck scan <directory> [options]
```

| Option | Description | Default |
|---|---|---|
| `--json` | Output raw JSON instead of the formatted terminal report | `false` |
| `--output <file>` | Write JSON to a file (implies `--json`) | — |
| `--large-threshold <mb>` | "Medium" file threshold in MB | `100` |
| `--old-threshold <days>` | "Old" file threshold in days since last modification | `180` |
| `--no-hidden` | Exclude hidden files and directories (dot-files) | Hidden included |
| `--follow-symlinks` | Follow symbolic links during traversal | `false` (safe default) |

---

### `review <directory>`

Interactively review file recommendations and curate an in-memory cleanup plan.

```bash
grumpyduck review <directory> [options]
```

| Option | Description | Default |
|---|---|---|
| `--export <file>` | Export review decisions to a structured JSON cleanup plan | — |
| `--large-threshold <mb>` | "Medium" file threshold in MB | `100` |
| `--old-threshold <days>` | "Old" file threshold in days since last modification | `180` |
| `--no-hidden` | Exclude hidden files and directories | Hidden included |
| `--follow-symlinks` | Follow symbolic links during traversal | `false` (safe default) |

---

## Interactive Keyboard Controls

During an active review session, GrumpyDuck presents one candidate at a time with the following controls:

| Key | Action | Description |
|:---:|---|---|
| **`K`** | **Keep** | Mark file to be retained |
| **`C`** | **Mark for Cleanup** | Add file to the in-memory cleanup plan (no files deleted) |
| **`S`** | **Skip** | Skip decision for this candidate for now |
| **`D`** | **Details** | Display comprehensive metadata, duplicate group paths, and reasons |
| **`Q`** | **Quit** | End review session and display final summary (exports plan if requested) |

---

## Review Flow Example

```text
🦆  GrumpyDuck — Cleanup Review

Scanning: /Users/you/Downloads

Found:

  📋 Duplicate candidates:    248
  💿 Installer candidates:    21
  📦 Large files to review:   5
  🕰️  Other review candidates: 557

Potential duplicate space: 640.99 MB

⚠️  No files will be modified during this review.

────────────────────────────────────────────────────

🦆  GrumpyDuck: "I found an extra copy. You probably only need one of these."  [1/831]

  3853_40_94_Module_2_AC (2).pptx

  Type:        📄 Document
  Size:        4.58 MB
  Location:    /Users/you/Downloads/3853_40_94_Module_2_AC (2).pptx
  Status:      DUPLICATE (4 identical copies exist)
  Suggestion:  POTENTIAL CLEANUP
  Why:
    • Identical content hash matches other files
    • Redundant duplicate copy

What should I do?
  [K] Keep     [C] Mark for cleanup     [S] Skip     [D] Details     [Q] Quit

> C
────────────────────────────────────────────────────

🦆  GrumpyDuck — Review Complete

  Files reviewed:      1 / 831
  KEEP:                0
  Marked for cleanup:  1
  Skipped:             0

────────────────────────────────────────────────────

Potential space from selected files: 4.58 MB

⚠️  Nothing was deleted.
   Your cleanup selections are only a plan. No files have been modified.
```

---

## Cleanup Plan Export Schema

When running `npm start -- review <path> --export plan.json`, the output schema is:

```json
{
  "scanPath": "/Users/you/Downloads",
  "createdAt": "2026-08-20T06:10:00.000Z",
  "readOnly": true,
  "summary": {
    "totalReviewed": 3,
    "keptCount": 1,
    "cleanupCount": 1,
    "skippedCount": 1,
    "totalSelectedBytes": 4806439
  },
  "files": [
    {
      "path": "/Users/you/Downloads/3853_40_94_Module_2_AC (2).pptx",
      "name": "3853_40_94_Module_2_AC (2).pptx",
      "size": 4806439,
      "classification": "DOCUMENT",
      "recommendation": "POTENTIAL_CLEANUP",
      "userDecision": "CLEANUP",
      "reasons": [
        "Identical content hash matches other files",
        "Redundant duplicate copy"
      ]
    }
  ],
  "totalSelectedBytes": 4806439
}
```

---

## Safety Limitations & Protected Paths

GrumpyDuck is **strictly read-only**. It will never:

- Delete files (`fs.unlink`, `fs.rm`, `trash`)
- Move or rename files
- Modify file contents or metadata
- Empty Trash
- Change file permissions
- Send file contents to external services

### Protected System Paths

GrumpyDuck includes a safety verification layer (`src/safety/protectedPaths.ts`) that protects:
- `/System`, `/Library`, `/usr`, `/bin`, `/sbin`, `/etc`, `/dev`, `/var`, `/private`
- User sensitive security directories (e.g. `~/Library/Keychains`)
- Root filesystem `/`

---

## Project Architecture

```
grumpyduck/
│
├── src/
│   ├── cli/
│   │   └── index.ts               CLI entry point (`scan`, `review`)
│   │
│   ├── review/
│   │   ├── reviewer.ts            Interactive review engine & candidate extractor
│   │   ├── session.ts             In-memory review session state manager
│   │   ├── display.ts             CLI UI formatting & details view
│   │   └── export.ts              Cleanup plan JSON builder and exporter
│   │
│   ├── safety/
│   │   └── protectedPaths.ts      System & security protected path verification
│   │
│   ├── intelligence/
│   │   ├── index.ts               Main intelligence orchestrator & summary builder
│   │   ├── classifier.ts          Context + pattern-aware classifier
│   │   ├── rules.ts               Declarative keyword patterns & extension mappings
│   │   ├── recommendation.ts      Conservative recommendations & explanation generator
│   │   ├── confidence.ts          Confidence score calculation (0.0–1.0 -> High/Med/Low)
│   │   └── context.ts             Path context helpers (Downloads, dev dirs, etc.)
│   │
│   ├── scanner/
│   │   ├── scanner.ts             Main scan engine (recursive walk, bundle stats, duplicates)
│   │   ├── fileMetadata.ts        Pure function: path + Stats → FileMetadata
│   │   ├── duplicates.ts          Two-phase duplicate detection (size → hash)
│   │   ├── categories.ts          Extension → FileCategory mapping (130+ extensions)
│   │   └── rules.ts               Size and age classification rules + default config
│   │
│   ├── reports/
│   │   ├── terminalReport.ts      Formatted chalk terminal output with intelligence insights
│   │   └── jsonReport.ts          Stable JSON serialisation
│   │
│   ├── types/
│   │   ├── review.ts              Review items, decisions, session state, export schema
│   │   ├── intelligence.ts        Enums & types for classification, confidence, recommendations
│   │   └── scanner.ts             Shared scanner TypeScript interfaces
│   │
│   └── utils/
│       ├── formatBytes.ts         Human-readable file sizes
│       ├── formatDate.ts          Relative age strings
│       └── hash.ts                Streaming SHA-256 (256 KB chunks)
│
├── tests/
│   ├── safety.test.ts             Protected paths and safety test suite
│   ├── review.test.ts             Interactive review, prioritization & export test suite
│   ├── intelligence.test.ts       Vitest intelligence test suite (12 test groups)
│   └── scanner.test.ts            Vitest scanner test suite (48 test groups)
│
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Running Tests

```bash
# Run all tests once (66 tests across 4 test suites)
npm test

# Watch mode during development
npm run test:watch
```

Tests use temporary directories created with `os.tmpdir()`. No real user files are read or modified.

---

## Tauri Integration Guide

GrumpyDuck's scanner and review modules are ready to integrate directly with desktop UI frameworks like Tauri.

1. **Scan Command**: Invoke `scan()` to retrieve typed `ScanResult` with full intelligence metadata.
2. **Review Command**: Extract prioritized candidates with `extractReviewCandidates()` and manage UI review queue using `ReviewSession`.
3. **Export & Actions**: Generate actionable cleanup plans using `buildCleanupPlan()`.

---

*GrumpyDuck is grumpy because it cares.*
