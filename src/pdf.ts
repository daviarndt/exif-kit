/**
 * Minimal single-page PDF that embeds a JPEG losslessly (DCTDecode).
 *
 * The JPEG bytes are stored verbatim, so no pixels are re-encoded and the
 * full resolution is preserved. The page is sized so the image prints at
 * `dpi` (150 by default), which keeps a contact sheet at a sensible physical
 * size while the embedded image stays high resolution.
 *
 * Hand-written to avoid a PDF-library dependency: a contact sheet is a single
 * image on a single page, which the PDF format expresses in five objects.
 */

export function jpegToPdf(
  jpeg: Buffer,
  widthPx: number,
  heightPx: number,
  dpi = 150,
): Buffer {
  const pageW = (widthPx * 72) / dpi;
  const pageH = (heightPx * 72) / dpi;
  const w = pageW.toFixed(2);
  const h = pageH.toFixed(2);

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const objects: (string | Buffer)[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  // Image XObject: the JPEG stream, filtered as DCTDecode.
  const imgDict =
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
    `/Length ${jpeg.length} >>`;
  const imgObj = Buffer.concat([
    Buffer.from(`${imgDict}\nstream\n`, "latin1"),
    jpeg,
    Buffer.from("\nendstream", "latin1"),
  ]);
  objects.push(imgObj);
  // Content stream: place the image to fill the page (PDF y-axis is bottom-up).
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  objects.push(
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );

  const chunks: Buffer[] = [Buffer.from(header, "latin1")];
  const offsets: number[] = [];
  let position = Buffer.byteLength(header, "latin1");

  objects.forEach((body, i) => {
    offsets[i] = position;
    const head = Buffer.from(`${i + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "latin1") : body;
    const obj = Buffer.concat([head, bodyBuf, tail]);
    chunks.push(obj);
    position += obj.length;
  });

  const xrefStart = position;
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  xref +=
    `trailer\n<< /Size ${count} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}
