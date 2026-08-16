# 🦆 GrumpyDuck — Phase 1.1: File Scanner (macOS-Aware)

> A read-only local file-organisation assistant that tells you the truth about your storage.

GrumpyDuck scans a directory, analyses its contents, and produces a detailed report — but **never touches a single file**. It is a duck, not a broom.

---

## What's New in Phase 1.1: macOS-Aware Scanner

- **macOS `.app` Bundle Awareness**: Treats `.app`, `.bundle`, `.framework`, `.plugin`, `.kext`, and `.xpc` packages as single logical items.
- **Bundle Internal Exclusion**: Prevents application internal files (`Info.plist`, `.nib`, `.icns`, frameworks, localization folders) from polluting old-file detection, duplicate detection, empty-folder reporting, or file-level cleanup statistics.
- **Logical vs Physical Item Reporting**: Reports logical items scanned for user clarity, while tracking physical files and directories on disk.
- **Applications Category**: Categorises `.app` bundles under a dedicated `Applications` category.
- **Context-Aware Remarks**: Dynamic, accurate GrumpyDuck remarks based on scan statistics.

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [Configuration Options](#configuration-options)
- [Output Formats](#output-formats)
- [Report Format (JSON Schema)](#report-format-json-schema)
- [Safety Limitations](#safety-limitations)
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
# Scan your Downloads folder
npm start -- scan ~/Downloads

# Scan any directory
npm start -- scan /path/to/any/folder

# Output as JSON (to stdout)
npm start -- scan ~/Downloads --json

# Write JSON report to a file
npm start -- scan ~/Downloads --output report.json
```

---

## CLI Commands

### `scan <directory>`

Scan a directory and generate a file-organisation report.

```
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

## Configuration Options

All thresholds are configurable via CLI flags. The defaults are:

| Threshold | Default | Flag |
|---|---|---|
| Very Large files | > 1 GB | (derived from `--large-threshold * 10`) |
| Large files | > 500 MB | (derived from `--large-threshold * 5`) |
| Medium files | > 100 MB | `--large-threshold 100` |
| Old files | > 180 days since modification | `--old-threshold 180` |
| Very Old files | > 365 days since modification | (derived from `--old-threshold * 2`) |
| Follow symlinks | Never | `--follow-symlinks` |
| Include hidden | Yes | `--no-hidden` to exclude |

> **Note**: The `veryLargeBytes` and `largeBytes` thresholds are currently fixed at `1 GB` and `500 MB` respectively. They can be adjusted by editing `src/scanner/rules.ts:DEFAULT_CONFIG`. Future CLI flags for these are planned.

---

## Output Formats

### Terminal (default)

```
🦆  GrumpyDuck is investigating…

Scanning: /Users/you/Downloads

Files scanned:     1,284
Folders scanned:     143
Total storage:     48.70 GB

────────────────────────────────────────────────────

📂  File Categories

  Videos       ████████████████████     432 files    32.10 GB
  Archives     ██████████░░░░░░░░░░     210 files     8.40 GB
  Documents    ██████░░░░░░░░░░░░░░     185 files     1.20 GB
  ...

────────────────────────────────────────────────────

📦  Large Files
  23 files detected

  [Very Large] Ubuntu-22.04.iso
       5.20 GB  /Users/you/Downloads/Ubuntu-22.04.iso
  ...

🕰️  Potentially Old Files
  71 files detected
  Note: Age alone does not mean a file is unwanted.

  [Very Old] project-backup-2021.zip
       Last modified: 3 years ago  /Users/you/Downloads/...

📋  Duplicate Files
  14 duplicate groups (18 extra copies, 6.70 GB wasted)

  Duplicate Group — 2.40 MB each
  Hash: a1b2c3d4e5f6…
    photo.png  /Users/you/Pictures/photo.png
    photo-copy.png  /Users/you/Downloads/photo-copy.png

📁  Empty Folders
  8 empty folders detected

────────────────────────────────────────────────────

🧹  Potential Cleanup

  Large files:       8.40 GB
  Old files:         2.10 GB
  Duplicate waste:   6.70 GB

  Potentially recoverable: 17.20 GB
  (Files may overlap between categories — total is deduplicated)

🦆  GrumpyDuck says:
   "I've seen cleaner hard drives at a landfill."

⚠️  GrumpyDuck is read-only. Nothing was deleted, moved, or modified.
   All results are labelled "Potential cleanup candidate" — review before acting.
```

### JSON (`--json` / `--output`)

Structured JSON containing all scan data. See [Report Format](#report-format-json-schema) below.

---

## Report Format (JSON Schema)

The JSON output follows a stable schema versioned by the `schemaVersion` field.

```json
{
  "schemaVersion": "1.0.0",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T10:30:45.123Z",
  "scannedPath": "/Users/you/Downloads",
  "config": {
    "veryLargeBytes": 1073741824,
    "largeBytes": 524288000,
    "mediumBytes": 104857600,
    "veryOldDays": 365,
    "oldDays": 180,
    "followSymlinks": false,
    "includeHidden": true
  },
  "files": [
    {
      "name": "Ubuntu-22.04.iso",
      "path": "/Users/you/Downloads/Ubuntu-22.04.iso",
      "extension": "iso",
      "size": 5583457280,
      "createdAt": 1705312200000,
      "modifiedAt": 1705312200000,
      "accessedAt": 1705312200000,
      "category": "Installers",
      "isHidden": false,
      "parent": "/Users/you/Downloads",
      "sizeLabel": "Very Large",
      "ageLabel": null,
      "hash": null
    }
  ],
  "emptyDirectories": [
    "/Users/you/Downloads/old-project"
  ],
  "duplicateGroups": [
    {
      "hash": "a1b2c3d4...",
      "size": 2516582,
      "files": [...]
    }
  ],
  "errors": [
    {
      "path": "/Users/you/Downloads/.Trash",
      "message": "Cannot read directory: Permission denied",
      "code": "EACCES"
    }
  ],
  "summary": {
    "totalFiles": 1284,
    "totalDirectories": 143,
    "totalBytes": 52318310400,
    "largeFileCount": 23,
    "largeFileBytes": 9023897600,
    "oldFileCount": 71,
    "oldFileBytes": 2254857625,
    "duplicateGroupCount": 14,
    "duplicateWastedBytes": 7195796480,
    "emptyDirectoryCount": 8,
    "potentialCleanupBytes": 18479488000,
    "categories": [
      { "category": "Videos", "count": 432, "totalBytes": 34468700160 },
      { "category": "Archives", "count": 210, "totalBytes": 9021194240 }
    ]
  }
}
```

---

## Safety Limitations

GrumpyDuck Phase 1 is **strictly read-only**. It will never:

- Delete files
- Move or rename files
- Modify file contents or metadata
- Empty Trash
- Change file permissions
- Upload files anywhere
- Send file contents to any external service
- Automatically mark files as safe to delete

**Labels used in Phase 1:**
- `Detected` — a file that matched a rule (size, age, duplicate)
- `Potential cleanup candidate` — a file that *may* be removable, but the user must decide

The label `Safe to delete` is **never used** in Phase 1. Age, size, or location alone are not sufficient reasons to delete a file.

---

## Project Architecture

```
grumpyduck/
│
├── src/
│   ├── cli/
│   │   └── index.ts          CLI entry point (commander)
│   │
│   ├── scanner/
│   │   ├── scanner.ts         Main scan engine (recursive walk, rule application)
│   │   ├── fileMetadata.ts    Pure function: path + Stats → FileMetadata
│   │   ├── duplicates.ts      Two-phase duplicate detection (size → hash)
│   │   ├── categories.ts      Extension → FileCategory mapping (130+ extensions)
│   │   └── rules.ts           Size and age classification rules + default config
│   │
│   ├── reports/
│   │   ├── terminalReport.ts  Coloured chalk terminal output
│   │   └── jsonReport.ts      Stable JSON serialisation
│   │
│   ├── types/
│   │   └── scanner.ts         All shared TypeScript interfaces
│   │
│   └── utils/
│       ├── formatBytes.ts     Human-readable file sizes
│       ├── formatDate.ts      Relative age strings
│       └── hash.ts            Streaming SHA-256 (256 KB chunks)
│
├── tests/
│   └── scanner.test.ts        Vitest test suite (12 test groups, tmp dirs only)
│
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Design Principles

1. **Scanner independence**: `src/scanner/` has zero dependency on `src/cli/` or `src/reports/`. It can be imported directly by any Tauri backend.
2. **Pure where possible**: `collectFileMetadata` and `isLargeFile`/`isOldFile` are pure functions that accept mock `Stats` in tests.
3. **Iterative DFS**: The directory walker uses an explicit stack instead of recursion to avoid Node.js call-stack overflow on deeply nested trees.
4. **Streaming hashes**: Files are hashed in 256 KB chunks so RAM usage stays constant regardless of file size.
5. **Stable JSON schema**: `schemaVersion: "1.0.0"` allows future consumers to detect breaking changes.

---

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode during development
npm run test:watch
```

Tests use temporary directories created with `os.tmpdir()`. No real user files are read or modified.

---

## Tauri Integration Guide

GrumpyDuck's scanner was designed from the start to become the backend of a Tauri desktop application.

### Step 1 — Use the scanner as a Tauri command

In your Tauri Rust backend, invoke the Node.js CLI as a sidecar, or — better — rewrite `src/scanner/` in Rust using the same interface shapes.

The JSON output (`--json` flag) is the integration contract. The `schemaVersion` field lets the frontend handle schema migrations gracefully.

### Step 2 — Consume the JSON report in the Tauri frontend

```typescript
// In your Tauri frontend (e.g. React or Vue component)
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<ScanResult>('scan_directory', { path: '~/Downloads' });

// result.summary, result.files, result.duplicateGroups, result.emptyDirectories
// are all typed and ready to render
```

### Step 3 — Import shared types

Copy `src/types/scanner.ts` into your Tauri frontend `src/` directory (or publish it as a shared package). All interfaces are already designed for JSON serialisation.

### Step 4 — Phase 2 features to add

- Tauri file dialog for directory selection
- Progress events streamed back to the frontend during long scans
- The animated GrumpyDuck character
- User-controlled file management (move to Trash — never auto-delete)
- AI-powered suggestions using Gemini API
- Persistent scan history

---

*GrumpyDuck is grumpy because it cares.*
# grumpy_files
