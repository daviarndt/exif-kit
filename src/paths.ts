/**
 * Resolving user-supplied paths (files, directories, glob patterns).
 *
 * Globbing is implemented here (case-insensitive, supports `*`, `?` and
 * `**`) instead of using fs.globSync, which still prints an experimental
 * warning on some Node versions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { SUPPORTED_EXTENSIONS, extensionOf } from "./fields.js";

function expandHome(p: string): string {
  if (p === "~" || p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function hasMagic(segment: string): boolean {
  return /[*?]/.test(segment);
}

function segmentToRegExp(segment: string): RegExp {
  const escaped = segment
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`, "i");
}

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function globMatch(baseDir: string, segments: string[]): string[] {
  if (segments.length === 0) return [baseDir];
  const [head, ...rest] = segments;

  if (head === "**") {
    const results = new Set<string>(globMatch(baseDir, rest));
    for (const entry of listDir(baseDir)) {
      const full = path.join(baseDir, entry);
      if (fs.statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        for (const m of globMatch(full, segments)) results.add(m);
      }
    }
    return [...results];
  }

  if (!hasMagic(head)) {
    const full = baseDir ? path.join(baseDir, head) : head;
    return fs.existsSync(full) ? globMatch(full, rest) : [];
  }

  const pattern = segmentToRegExp(head);
  const results: string[] = [];
  for (const entry of listDir(baseDir || ".")) {
    if (pattern.test(entry)) {
      results.push(...globMatch(path.join(baseDir, entry), rest));
    }
  }
  return results;
}

function glob(pattern: string): string[] {
  const absolute = path.isAbsolute(pattern);
  const segments = pattern.split(/[/\\]+/).filter(Boolean);
  const base = absolute ? path.sep : ".";
  const matches = globMatch(absolute ? base : "", segments);
  return matches
    .map((m) => (absolute && !path.isAbsolute(m) ? path.join(base, m) : m))
    .sort();
}

function supportedFilesIn(dir: string, recursive: boolean): string[] {
  const results: string[] = [];
  for (const entry of listDir(dir).sort()) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full, { throwIfNoEntry: false });
    if (stat?.isDirectory() && recursive) {
      results.push(...supportedFilesIn(full, true));
    } else if (stat?.isFile() && SUPPORTED_EXTENSIONS.has(extensionOf(entry))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Turn a mix of files, directories and glob patterns into a file list.
 *
 * Directories expand to the supported photo/video files directly inside
 * them (or recursively with `recursive`). Nonexistent paths throw so
 * typos fail loudly instead of being silently skipped.
 */
export function expandPaths(inputs: string[], recursive = false): string[] {
  const files: string[] = [];
  for (const raw of inputs) {
    const input = expandHome(raw);
    const stat = fs.statSync(input, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      files.push(...supportedFilesIn(input, recursive));
    } else if (stat?.isFile()) {
      files.push(input);
    } else {
      const matches = glob(input).filter((m) =>
        fs.statSync(m, { throwIfNoEntry: false })?.isFile(),
      );
      if (matches.length === 0) {
        throw new Error(`No file matches "${raw}".`);
      }
      files.push(...matches);
    }
  }

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const f of files) {
    const resolved = path.resolve(f);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      unique.push(f);
    }
  }
  return unique;
}
