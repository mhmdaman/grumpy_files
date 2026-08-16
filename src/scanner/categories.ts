import { FileCategory } from '../types/scanner';

// ─────────────────────────────────────────────────────────────────────────────
// Extension → Category mapping
//
// Extensions are lower-cased without a leading dot.
// Add new entries here to extend categorization without touching any other file.
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, FileCategory> = {
  // ── Images ────────────────────────────────────────────────────────────────
  jpg: 'Images',
  jpeg: 'Images',
  png: 'Images',
  gif: 'Images',
  bmp: 'Images',
  svg: 'Images',
  webp: 'Images',
  tiff: 'Images',
  tif: 'Images',
  heic: 'Images',
  heif: 'Images',
  ico: 'Images',
  raw: 'Images',
  cr2: 'Images',
  nef: 'Images',
  arw: 'Images',
  dng: 'Images',
  psd: 'Images',
  xcf: 'Images',

  // ── Videos ────────────────────────────────────────────────────────────────
  mp4: 'Videos',
  mkv: 'Videos',
  avi: 'Videos',
  mov: 'Videos',
  wmv: 'Videos',
  flv: 'Videos',
  webm: 'Videos',
  m4v: 'Videos',
  mpg: 'Videos',
  mpeg: 'Videos',
  '3gp': 'Videos',
  // Note: .ts is kept under Code (TypeScript); video transport streams are rare
  mts: 'Videos',
  m2ts: 'Videos',
  vob: 'Videos',
  ogv: 'Videos',

  // ── Audio ─────────────────────────────────────────────────────────────────
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  aac: 'Audio',
  ogg: 'Audio',
  wma: 'Audio',
  m4a: 'Audio',
  aiff: 'Audio',
  aif: 'Audio',
  opus: 'Audio',
  mid: 'Audio',
  midi: 'Audio',

  // ── Documents ─────────────────────────────────────────────────────────────
  pdf: 'Documents',
  doc: 'Documents',
  docx: 'Documents',
  xls: 'Documents',
  xlsx: 'Documents',
  ppt: 'Documents',
  pptx: 'Documents',
  odt: 'Documents',
  ods: 'Documents',
  odp: 'Documents',
  txt: 'Documents',
  rtf: 'Documents',
  md: 'Documents',
  markdown: 'Documents',
  csv: 'Documents',
  epub: 'Documents',
  mobi: 'Documents',
  pages: 'Documents',
  numbers: 'Documents',
  keynote: 'Documents',

  // ── Archives ──────────────────────────────────────────────────────────────
  zip: 'Archives',
  tar: 'Archives',
  gz: 'Archives',
  bz2: 'Archives',
  xz: 'Archives',
  '7z': 'Archives',
  rar: 'Archives',
  tgz: 'Archives',
  tbz2: 'Archives',
  zst: 'Archives',
  lz4: 'Archives',
  lzma: 'Archives',
  cab: 'Archives',

  // ── Installers ────────────────────────────────────────────────────────────
  dmg: 'Installers',
  pkg: 'Installers',
  exe: 'Installers',
  msi: 'Installers',
  deb: 'Installers',
  rpm: 'Installers',
  appimage: 'Installers',
  snap: 'Installers',
  iso: 'Installers',

  // ── Code ──────────────────────────────────────────────────────────────────
  js: 'Code',
  mjs: 'Code',
  cjs: 'Code',
  ts: 'Code',
  tsx: 'Code',
  jsx: 'Code',
  py: 'Code',
  rb: 'Code',
  rs: 'Code',
  go: 'Code',
  java: 'Code',
  kt: 'Code',
  swift: 'Code',
  c: 'Code',
  cpp: 'Code',
  cc: 'Code',
  h: 'Code',
  hpp: 'Code',
  cs: 'Code',
  php: 'Code',
  sh: 'Code',
  bash: 'Code',
  zsh: 'Code',
  fish: 'Code',
  ps1: 'Code',
  html: 'Code',
  css: 'Code',
  scss: 'Code',
  sass: 'Code',
  json: 'Code',
  yaml: 'Code',
  yml: 'Code',
  toml: 'Code',
  xml: 'Code',
  sql: 'Code',
  graphql: 'Code',
  gql: 'Code',
  vue: 'Code',
  svelte: 'Code',
  dart: 'Code',
  lua: 'Code',
  r: 'Code',
  matlab: 'Code',
  pl: 'Code',
  ex: 'Code',
  exs: 'Code',
  erl: 'Code',
  hs: 'Code',
  elm: 'Code',
  clj: 'Code',
  scala: 'Code',
  nim: 'Code',
  zig: 'Code',
};

export const DEFAULT_BUNDLE_EXTENSIONS = ['app', 'bundle', 'framework', 'plugin', 'kext', 'xpc'];

/**
 * Check whether a directory name matches a package/bundle extension (e.g. "VSCode.app").
 */
export function isBundleDirectory(
  dirName: string,
  bundleExtensions: string[] = DEFAULT_BUNDLE_EXTENSIONS,
): boolean {
  const dotIndex = dirName.lastIndexOf('.');
  if (dotIndex <= 0) return false;
  const ext = dirName.slice(dotIndex + 1).toLowerCase();
  return bundleExtensions.includes(ext);
}

/**
 * Determine the FileCategory for a given file extension.
 *
 * @param extension  Lower-cased extension WITHOUT a leading dot.
 *                   Pass an empty string for files with no extension.
 * @returns          The matching FileCategory, or 'Other' for unknown extensions.
 */
export function getCategory(extension: string): FileCategory {
  if (!extension) return 'Other';
  const lowerExt = extension.toLowerCase();
  if (DEFAULT_BUNDLE_EXTENSIONS.includes(lowerExt)) {
    return 'Applications';
  }
  return EXTENSION_MAP[lowerExt] ?? 'Other';
}

export { EXTENSION_MAP };

