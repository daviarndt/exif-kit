import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { jpegToPdf } from "../src/pdf.js";

async function jpeg(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: "#888888" },
  })
    .jpeg()
    .toBuffer();
}

describe("jpegToPdf", () => {
  it("wraps a JPEG into a valid single-page PDF", async () => {
    const jpg = await jpeg(600, 400);
    const pdf = jpegToPdf(jpg, 600, 400);
    const head = pdf.subarray(0, 8).toString("latin1");
    const tail = pdf.subarray(pdf.length - 6).toString("latin1");
    expect(head).toBe("%PDF-1.4");
    expect(tail).toBe("%%EOF\n");
    expect(pdf.includes(Buffer.from("/DCTDecode"))).toBe(true);
    expect(pdf.includes(Buffer.from("/MediaBox"))).toBe(true);
    // the original JPEG bytes are embedded verbatim (lossless)
    expect(pdf.includes(jpg)).toBe(true);
  });

  it("sizes the page from pixels and dpi", async () => {
    const jpg = await jpeg(300, 150);
    const pdf = jpegToPdf(jpg, 300, 150, 150).toString("latin1");
    // 300px / 150dpi * 72 = 144pt wide, 72pt tall
    expect(pdf).toContain("/MediaBox [0 0 144.00 72.00]");
  });

  it("has a consistent xref count", async () => {
    const pdf = jpegToPdf(await jpeg(100, 100), 100, 100).toString("latin1");
    expect(pdf).toContain("/Size 6"); // 5 objects + free entry
    expect(pdf).toMatch(/startxref\n\d+\n%%EOF/);
  });
});
