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
exports.collectFileMetadata = collectFileMetadata;
const path = __importStar(require("path"));
const categories_1 = require("./categories");
/**
 * Build a FileMetadata object from a file path and its fs.Stats.
 *
 * This function is deliberately pure (no filesystem calls) so that it can
 * be called with mock stats in tests.
 *
 * @param filePath  Absolute path to the file.
 * @param stats     fs.Stats returned by fs.stat() — never lstat, so symlinks
 *                  are resolved to their targets. The caller controls whether
 *                  symlinks are followed.
 * @returns         Populated FileMetadata with analysis flags initialised to null.
 */
function collectFileMetadata(filePath, stats) {
    const name = path.basename(filePath);
    const parent = path.dirname(filePath);
    // Extract extension: take everything after the last dot, excluding the dot
    // itself. Files like ".gitignore" have no real extension; treat them as
    // hidden files with an empty extension.
    const dotIndex = name.lastIndexOf('.');
    const extension = dotIndex > 0 // > 0 excludes dot-files like ".bashrc"
        ? name.slice(dotIndex + 1).toLowerCase()
        : '';
    // A file is hidden on Unix/macOS if its name starts with a dot.
    const isHidden = name.startsWith('.');
    return {
        name,
        path: filePath,
        extension,
        size: stats.size,
        // birthtime may be 0 on Linux ext4; that is fine — callers should treat 0 as unavailable.
        createdAt: stats.birthtimeMs,
        modifiedAt: stats.mtimeMs,
        accessedAt: stats.atimeMs,
        category: (0, categories_1.getCategory)(extension),
        isHidden,
        parent,
        // Analysis flags are set later by rules.ts and duplicates.ts
        sizeLabel: null,
        ageLabel: null,
        hash: null,
    };
}
//# sourceMappingURL=fileMetadata.js.map