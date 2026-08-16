"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJSON = toJSON;
exports.writeJSONReport = writeJSONReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ─────────────────────────────────────────────────────────────────────────────
// JSON reporter
//
// Serialises the ScanResult to a stable JSON schema for consumption by
// the future Tauri desktop UI or any other tool.
//
// Schema stability note: The top-level shape of this output tracks the
// ScanResult interface in types/scanner.ts. The `schemaVersion` field allows
// consumers to detect breaking changes.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Serialise a ScanResult to a formatted JSON string.
 *
 * The result includes all data needed to reconstruct any view in the future
 * Tauri desktop UI without re-scanning.
 */
function toJSON(result) {
    // We use JSON.stringify with indentation for readability when the user
    // pipes the output to a file. For machine consumption the whitespace
    // is ignored.
    return JSON.stringify(result, null, 2);
}
/**
 * Write a JSON report.
 *
 * @param result   The completed ScanResult.
 * @param outPath  Optional file path. If omitted, the JSON is written to stdout.
 */
async function writeJSONReport(result, outPath) {
    const json = toJSON(result);
    if (!outPath) {
        process.stdout.write(json + '\n');
        return;
    }
    // Ensure the output directory exists before writing.
    const dir = path.dirname(path.resolve(outPath));
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(outPath, json, 'utf-8');
    // Confirm to the user where the file was written (goes to stderr so it
    // doesn't pollute the JSON stream if they are piping stdout).
    process.stderr.write(`\n🦆  GrumpyDuck: JSON report written to ${outPath}\n\n`);
}
//# sourceMappingURL=jsonReport.js.map