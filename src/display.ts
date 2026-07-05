/** Rendering of metadata for the terminal. */

import Table from "cli-table3";
import pc from "picocolors";

import type { Metadata } from "./engine.js";

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function formatExposure(value: unknown): string {
  const seconds = asNumber(value);
  if (seconds === undefined) return String(value);
  if (seconds >= 1) return `${seconds}s`;
  return `1/${Math.round(1 / seconds)}s`;
}

export function formatSize(value: unknown): string {
  let size = asNumber(value);
  if (size === undefined) return String(value);
  if (size < 1024) return `${size} B`;
  for (const unit of ["KB", "MB", "GB", "TB"]) {
    size /= 1024;
    if (size < 1024 || unit === "TB") return `${size.toFixed(1)} ${unit}`;
  }
  return String(value);
}

export function formatDuration(value: unknown): string {
  const total = asNumber(value);
  if (total === undefined) return String(value);
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${minutes}m ${pad(seconds)}s`;
}

export function formatGps(metadata: Metadata): string | undefined {
  const lat = asNumber(metadata.GPSLatitude);
  const lon = asNumber(metadata.GPSLongitude);
  if (lat === undefined || lon === undefined) {
    const coords = metadata.GPSCoordinates; // QuickTime videos
    return coords ? String(coords) : undefined;
  }
  let text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  const altitude = asNumber(metadata.GPSAltitude);
  if (altitude !== undefined) text += `  (altitude ${altitude.toFixed(1)}m)`;
  return text;
}

/** Build [label, value] rows for the curated summary view. */
export function summaryRows(metadata: Metadata): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      rows.push([label, String(value)]);
    }
  };

  add("File", metadata.FileName);
  add("Type", metadata.FileType);
  if (metadata.FileSize !== undefined) add("Size", formatSize(metadata.FileSize));
  const width = asNumber(metadata.ImageWidth);
  const height = asNumber(metadata.ImageHeight);
  if (width && height) add("Dimensions", `${width} x ${height}`);

  const camera = [metadata.Make, metadata.Model].filter(Boolean).join(" ");
  add("Camera", camera || undefined);
  add("Lens", metadata.LensModel ?? metadata.LensID);

  add("ISO", metadata.ISO);
  const fNumber = asNumber(metadata.FNumber);
  if (fNumber !== undefined) add("Aperture", `f/${fNumber}`);
  if (metadata.ExposureTime !== undefined) {
    add("Shutter", formatExposure(metadata.ExposureTime));
  }
  const focal = asNumber(metadata.FocalLength);
  if (focal !== undefined) add("Focal length", `${focal}mm`);

  add("Taken (DateTimeOriginal)", metadata.DateTimeOriginal);
  add("Created (CreateDate)", metadata.CreateDate);
  add("Modified (ModifyDate)", metadata.ModifyDate);
  add("File modified", metadata.FileModifyDate);

  if (metadata.Duration !== undefined) {
    add("Duration", formatDuration(metadata.Duration));
  }

  add("GPS", formatGps(metadata) ?? "— none —");
  return rows;
}

export function printSummary(metadata: Metadata): void {
  console.log(pc.bold(pc.cyan(String(metadata.FileName ?? ""))));
  const table = new Table({ style: { head: [], border: [] } });
  for (const [label, value] of summaryRows(metadata)) {
    table.push([pc.bold(label), value]);
  }
  console.log(table.toString());
}

export function printAllTags(metadata: Metadata): void {
  console.log(pc.bold(pc.cyan(String(metadata.FileName ?? ""))));
  const table = new Table({
    head: [pc.bold("Tag"), pc.bold("Value")],
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [32, 60],
  });
  for (const key of Object.keys(metadata).sort()) {
    if (key === "SourceFile") continue;
    table.push([key, String(metadata[key])]);
  }
  console.log(table.toString());
}

export function printSuccess(message: string): void {
  console.log(`${pc.green(pc.bold("✓"))} ${message}`);
}

export function printError(message: string): void {
  console.error(pc.red(message));
}

export function describeFiles(paths: string[]): string {
  if (paths.length === 1) {
    const p = paths[0];
    return p.split(/[/\\]/).pop() ?? p;
  }
  return `${paths.length} files`;
}
