# 🦆 GrumpyDuck — Phase 1.2: File Intelligence & Recommendation Engine

> A read-only local file-organisation assistant that tells you the truth about your storage.

GrumpyDuck scans a directory, analyses its contents, interprets file purpose and context, and produces a detailed, intelligent report — but **never touches a single file**. It is a duck, not a broom.

---

## What's New in Phase 1.2: File Intelligence & Recommendation Engine

- **Context-Aware Classification**: Categorises files into 12 distinct intelligence categories (`DOCUMENT`, `DATASET`, `IMAGE`, `VIDEO`, `AUDIO`, `ARCHIVE`, `INSTALLER`, `APPLICATION`, `CODE`, `DEVELOPMENT_ARTIFACT`, `TEMPORARY_FILE`, `UNKNOWN`) using context, directory structure, and patterns beyond file extensions alone.
- **Dataset Intelligence**: Differentiates genuine datasets (e.g. `UNSW-NB15_training-set.csv`, `.parquet`, `.feather`, `.npy`) from ordinary spreadsheets (e.g. `expenses_2024.csv`) and prioritises keeping them.
- **Installer Recognition**: Identifies application installers (`.dmg`, `.pkg`, `.exe`, `.msi`, `.iso`) and flags them for review when stored in temporary locations like `Downloads`.
- **Developer Artifact Detection**: Detects build artifacts and project dependencies (`node_modules`, `dist`, `build`, `__pycache__`, `.venv`, `.next`, `.map`, `.pyc`) and recommends ignoring them rather than treating them as user documents.
- **Conservative Recommendation Hierarchy**: Employs deterministic `KEEP`, `REVIEW`, `POTENTIAL_CLEANUP`, and `IGNORE` recommendations. Never automatically assumes old age equals disposable material.
- **Transparent Explanations & Confidence Scoring**: Every recommendation provides human-readable reasons explaining *why*, accompanied by numeric confidence scores (0.00 – 1.00) mapped to `High`, `Medium`, and `Low` tiers.
- **Smart Cleanup Estimation**: Calculates conservative potential cleanup strictly from redundant duplicate copies (`POTENTIAL_CLEANUP`), preventing applications and normal large files from distorting actionable cleanup figures.
- **Organised Old Files Breakdown**: Splits old files into meaningful groups: *Potentially useful* (documents, datasets, archives), *Worth reviewing* (installers, duplicates), *Development/generated*, and *Ignored*.
- **macOS Application Bundle Handling**: Preserves logical application bundles (`.app`, `.framework`, `.plugin`, `.kext`, `.xpc`) and isolates bundle internals from user cleanup statistics.

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [Configuration Options](#configuration-options)
- [Intelligence & Recommendation System](#intelligence--recommendation-system)
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

---

## Intelligence & Recommendation System

GrumpyDuck decouples **raw observations** (size, age, duplicates, location) from **interpretative intelligence** (classification, confidence, recommendation, and reasoning):

| Classification | Observation Signals | Recommendation | Explanation Example |
|---|---|---|---|
| **`DATASET`** | Filename contains `training`, `dataset`, `features` or native format (`.parquet`) | `KEEP` | CSV dataset; old age alone is not sufficient reason to remove |
| **`INSTALLER`** | `.dmg`, `.pkg`, `.exe`, `.msi` in `Downloads/` | `REVIEW` | Application installer stored in Downloads; review if already installed |
| **`DEVELOPMENT_ARTIFACT`** | In `node_modules`, `dist`, `__pycache__`, or `.pyc`/`.map` | `IGNORE` | Generated or managed by developer tooling |
| **`DOCUMENT`** (Duplicate) | Identical SHA-256 hash to another file | `POTENTIAL_CLEANUP` | Extra redundant copy with identical content elsewhere |
| **`DOCUMENT`** (Old) | Unmodified > 365 days | `REVIEW` | Old document; review before archiving or deleting |
| **`APPLICATION`** | `.app` bundle directory | `KEEP` | Logical macOS application bundle |

---

## Output Formats

### Terminal (default)

```text
🦆  GrumpyDuck — Scan Complete

Scanned: /Users/you/Downloads

Logical items scanned: 1,383
Folders scanned:       118
Total storage:         9.41 GB

────────────────────────────────────────────────────
🧠  File Intelligence

  📊 Datasets
     18 files
     Recommendation: KEEP

  💿 Installers
     20 files
     Recommendation: REVIEW

  📋 Duplicates
     224 duplicate groups
     Recommendation: POTENTIAL CLEANUP

  🧩 Development Artifacts
     4 files
     Recommendation: IGNORE

  📄 Documents
     400 files
     Recommendation: REVIEW where appropriate

────────────────────────────────────────────────────
🦆  GrumpyDuck noticed:

  📊 UNSW-NB15_training-set.csv
     Dataset • 120.00 MB • Confidence: High
     → Keep
       • CSV file
       • Filename or format indicates dataset or training material

  💿 googlechrome.dmg
     Installer • 205.45 MB • Confidence: High
     → Review
       • DMG installer
       • Located in Downloads

  📄 notes (1).pdf
     Document • 2.80 MB • Confidence: High
     → Potential cleanup
       • Identical content hash matches other files
       • Redundant duplicate copy

────────────────────────────────────────────────────
📂  File Categories

  Installers   █░░░░░░░░░░░░░░░░░░░     20 files    4.04 GB
  Documents    ████████████████████    400 files    1.61 GB
  Videos       █░░░░░░░░░░░░░░░░░░░     10 files  830.79 MB
  Archives     █░░░░░░░░░░░░░░░░░░░     27 files  633.15 MB
  Applications ░░░░░░░░░░░░░░░░░░░░      2 apps   574.20 MB
  Images       ██████████████░░░░░░    281 files  115.33 MB
  ...

────────────────────────────────────────────────────
📦  Large Files
  17 files detected
  [Large] IMG_3732.MOV (588.59 MB)
  [Large] Visual Studio Code.app (571.14 MB)

🕰️   Old Files
  641 old files detected

  Potentially useful:
    209 documents
    13 datasets
    6 archives
  Worth reviewing:
    23 installers
    154 duplicate files
    236 other files

📋  Duplicate Files
  224 duplicate groups (248 extra copies, 640.99 MB wasted)

📁  Empty Folders
  5 empty folders detected

────────────────────────────────────────────────────
🧹  Potential Cleanup

  Large files:          5.91 GB
  Old files:            6.27 GB
  Duplicate waste:      640.99 MB

  Conservative Cleanup (Duplicates): 520.94 MB

  Potentially Recoverable: 8.04 GB
  (Estimate only. Files may be important and should be reviewed before deletion.)

────────────────────────────────────────────────────
🦆  GrumpyDuck says:
   "I found 224 duplicate groups. We should probably talk."

⚠️  GrumpyDuck is read-only. Nothing was deleted, moved, or modified.
   All recommendations are conservative — review before taking action.
```

### JSON (`--json` / `--output`)

Structured JSON containing all scan and intelligence data. See [Report Format](#report-format-json-schema) below.

---

## Report Format (JSON Schema)

The JSON output follows a stable schema versioned by `schemaVersion: "1.0.0"`.

```json
{
  "schemaVersion": "1.0.0",
  "startedAt": "2026-08-19T03:45:50.596Z",
  "completedAt": "2026-08-19T03:45:52.322Z",
  "scannedPath": "/Users/you/Downloads",
  "config": {
    "veryLargeBytes": 1073741824,
    "largeBytes": 524288000,
    "mediumBytes": 104857600,
    "veryOldDays": 365,
    "oldDays": 180,
    "followSymlinks": false,
    "includeHidden": true,
    "bundleExtensions": ["app", "bundle", "framework", "plugin", "kext", "xpc"]
  },
  "files": [
    {
      "name": "googlechrome.dmg",
      "path": "/Users/you/Downloads/googlechrome.dmg",
      "extension": "dmg",
      "size": 215429120,
      "createdAt": 1705312200000,
      "modifiedAt": 1705312200000,
      "accessedAt": 1705312200000,
      "category": "Installers",
      "isHidden": false,
      "parent": "/Users/you/Downloads",
      "sizeLabel": "Medium",
      "ageLabel": "Very Old",
      "hash": null,
      "intelligence": {
        "classification": {
          "type": "INSTALLER",
          "confidence": 0.98
        },
        "confidenceLevel": "High",
        "recommendation": {
          "action": "REVIEW",
          "reason": "This appears to be an application installer stored in Downloads.",
          "reasons": [
            "DMG installer",
            "Located in Downloads",
            "205.45 MB",
            "May no longer be required if the application is already installed"
          ]
        },
        "observations": ["LARGE", "OLD", "INSTALLER", "DOWNLOADS_LOCATION"],
        "isDuplicate": false
      }
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
  "errors": [],
  "summary": {
    "totalFiles": 1383,
    "logicalItemsScanned": 1383,
    "physicalFilesScanned": 1383,
    "physicalDirectoriesScanned": 118,
    "totalDirectories": 118,
    "totalBytes": 10103741824,
    "largeFileCount": 17,
    "largeFileBytes": 6345897600,
    "oldFileCount": 641,
    "oldFileBytes": 6732857625,
    "duplicateGroupCount": 224,
    "duplicateWastedBytes": 672124928,
    "potentialCleanupBytes": 8632832000,
    "smartCleanupBytes": 546242560,
    "categories": [
      { "category": "Installers", "count": 20, "totalBytes": 4337917952 },
      { "category": "Documents", "count": 400, "totalBytes": 1728708608 }
    ],
    "intelligenceSummary": {
      "categories": {
        "DOCUMENT": 400,
        "DATASET": 18,
        "INSTALLER": 20,
        "DEVELOPMENT_ARTIFACT": 4,
        "APPLICATION": 2
      },
      "recommendations": {
        "KEEP": 612,
        "REVIEW": 519,
        "POTENTIAL_CLEANUP": 248,
        "IGNORE": 4
      }
    }
  }
}
```

---

## Safety Limitations

GrumpyDuck is **strictly read-only**. It will never:

- Delete files
- Move or rename files
- Modify file contents or metadata
- Empty Trash
- Change file permissions
- Upload files anywhere
- Send file contents to any external service
- Automatically mark files as safe to delete

**Labels used:**
- `KEEP` — Identified as active user file, application bundle, or valuable dataset.
- `REVIEW` — File worth user attention (old files, installers in Downloads, large videos, etc.).
- `POTENTIAL_CLEANUP` — Identical duplicate copies or clear redundancy candidates.
- `IGNORE` — Build dependencies, package caches, and system internals.

The label `SAFE_TO_DELETE` is **never used**.

---

## Project Architecture

```
grumpyduck/
│
├── src/
│   ├── cli/
│   │   └── index.ts               CLI entry point (commander)
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
│   │   ├── intelligence.ts        Enums & types for classification, confidence, recommendations
│   │   └── scanner.ts             Shared scanner TypeScript interfaces
│   │
│   └── utils/
│       ├── formatBytes.ts         Human-readable file sizes
│       ├── formatDate.ts          Relative age strings
│       └── hash.ts                Streaming SHA-256 (256 KB chunks)
│
├── tests/
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
# Run all tests once (60 tests)
npm test

# Watch mode during development
npm run test:watch
```

Tests use temporary directories created with `os.tmpdir()`. No real user files are read or modified.

---

## Tauri Integration Guide

GrumpyDuck's scanner was designed from the start to serve as the backend of a Tauri desktop application.

### Step 1 — Use the scanner as a Tauri command

In your Tauri Rust backend, invoke the Node.js CLI as a sidecar, or write a Tauri command using the same JSON contract. The `schemaVersion` field ensures safe frontend migrations.

### Step 2 — Consume the JSON report in the Tauri frontend

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<ScanResult>('scan_directory', { path: '~/Downloads' });

// result.summary.intelligenceSummary
// result.files[0].intelligence.recommendation
// result.files[0].intelligence.confidenceLevel
```

### Step 3 — Import shared types

Copy `src/types/scanner.ts` and `src/types/intelligence.ts` into your Tauri frontend `src/` directory. All interfaces are designed for seamless JSON serialisation.

---

*GrumpyDuck is grumpy because it cares.*
