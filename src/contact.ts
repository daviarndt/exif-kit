/**
 * `exifreg contact`: render a contact sheet (thumbnail grid with filename
 * and exposure labels) as a single JPEG. Thumbnails reuse prepareSource,
 * so RAW files contribute their embedded previews; labels reuse the
 * portable vector-path text renderer from frame.ts.
 */

import * as path from "node:path";

import sharp from "sharp";
import type { OverlayOptions } from "sharp";

import type { Metadata } from "./engine.js";
import { buildCaption, prepareSource, renderText } from "./frame.js";

export interface ContactOptions {
  columns: number;
  /** Width of each cell's image box in pixels. */
  cellWidth: number;
  title: string;
  /** Sheet background color as #RRGGBB (default off-white). */
  background?: string;
  /** Include the EXIF exposure line under each thumbnail (default true). */
  exif?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

const DEFAULT_BG = "#FAF4EC";
const MARGIN = 48;
const GAP = 18;

/** Pick readable ink colors for a given background lightness. */
function inkFor(hex: string): { ink: string; soft: string; tile: string } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.45
    ? { ink: "#2E2E2E", soft: "#8A8073", tile: "#E7DDCD" }
    : { ink: "#F3EADC", soft: "#B9AE9E", tile: "#3A302A" };
}

export async function renderContactSheet(
  files: string[],
  metadata: Metadata[],
  out: string | null,
  options: ContactOptions,
): Promise<{ buffer: Buffer; width: number; height: number; cells: number }> {
  const BG = options.background ?? DEFAULT_BG;
  const { ink: INK, soft: INK_SOFT, tile: TILE } = inkFor(BG);
  const withExif = options.exif !== false;
  const cols = Math.max(1, Math.min(options.columns, files.length));
  const cellW = options.cellWidth;
  const imageH = Math.round((cellW * 3) / 4);
  const labelH = withExif ? 46 : 28;
  const cellH = imageH + labelH;
  const rows = Math.ceil(files.length / cols);

  const headerH = 92;
  const width = MARGIN * 2 + cols * cellW + (cols - 1) * GAP;
  const height = headerH + MARGIN + rows * cellH + (rows - 1) * GAP + MARGIN;

  const composites: OverlayOptions[] = [];

  // Header: title + count, Space Mono.
  const title = await renderText(options.title, 26, INK, true, width - MARGIN * 2);
  if (title) composites.push({ input: title.data, left: MARGIN, top: 34 });
  const sub = await renderText(
    `${files.length} files  ·  contact sheet  ·  exifregistry`,
    13, INK_SOFT, false, width - MARGIN * 2,
  );
  if (sub) composites.push({ input: sub.data, left: MARGIN, top: 34 + (title?.height ?? 0) + 8 });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options.onProgress?.(i + 1, files.length, path.basename(file));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = MARGIN + col * (cellW + GAP);
    const cellY = headerH + MARGIN + row * (cellH + GAP);

    const prepared = await prepareSource(file);
    try {
      const thumb = await sharp(prepared.path, { limitInputPixels: 1e9 })
        .rotate()
        .resize(cellW, imageH, { fit: "contain", background: TILE })
        .jpeg({ quality: 88 })
        .toBuffer();
      composites.push({ input: thumb, left: cellX, top: cellY });
    } catch {
      const placeholder = await renderText("(unreadable)", 13, INK_SOFT, false, cellW);
      if (placeholder) {
        composites.push({
          input: placeholder.data,
          left: cellX + Math.round((cellW - placeholder.width) / 2),
          top: cellY + Math.round(imageH / 2),
        });
      }
    } finally {
      prepared.cleanup();
    }

    const name = await renderText(path.basename(file), 12.5, INK, true, cellW);
    if (name) {
      composites.push({ input: name.data, left: cellX, top: cellY + imageH + 8 });
    }
    if (withExif) {
      const details = buildCaption(metadata[i] ?? {}, file).details;
      const info = await renderText(details, 11, INK_SOFT, false, cellW);
      if (info) {
        composites.push({
          input: info.data,
          left: cellX,
          top: cellY + imageH + 8 + (name?.height ?? 0) + 4,
        });
      }
    }
  }

  const pipeline = sharp({
    create: { width, height, channels: 3, background: BG },
  })
    .composite(composites)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" });

  const buffer = await pipeline.toBuffer();
  if (out) await sharp(buffer).toFile(out);

  return { buffer, width, height, cells: files.length };
}
