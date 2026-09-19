import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { OutgoingAttachment } from './email.js';

export type PdfStamp = {
  attachmentIndex: number;
  page: number;
  x: number;
  yTop: number;
  text: string;
  fontSize?: number;
};

export const MAX_PDF_STAMPS = 20;

// yTop is the bottom edge of the text line measured from the top of the page (as reported by pdftotext -bbox yMax).
export async function applyPdfStamps(attachments: OutgoingAttachment[], stamps: PdfStamp[], selectedIndexes: number[]): Promise<OutgoingAttachment[]> {
  if (stamps.length > MAX_PDF_STAMPS) throw new Error(`Too many PDF stamps (max ${MAX_PDF_STAMPS})`);
  const result = [...attachments];
  const byAttachment = new Map<number, PdfStamp[]>();
  for (const stamp of stamps) {
    const position = selectedIndexes.indexOf(stamp.attachmentIndex);
    if (position < 0) throw new Error(`PDF stamp refers to attachment ${stamp.attachmentIndex}, which is not being forwarded`);
    byAttachment.set(position, [...(byAttachment.get(position) ?? []), stamp]);
  }
  for (const [position, list] of byAttachment) {
    const attachment = result[position];
    const isPdf = /pdf/i.test(attachment.contentType ?? '') || /\.pdf$/i.test(attachment.filename);
    if (!isPdf) throw new Error(`Attachment ${attachment.filename} is not a PDF`);
    const doc = await PDFDocument.load(attachment.content, { updateMetadata: false });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    for (const stamp of list) {
      const page = pages[stamp.page - 1];
      if (!page) throw new Error(`Page ${stamp.page} does not exist in ${attachment.filename} (${pages.length} pages)`);
      const size = stamp.fontSize ?? 11;
      const { height } = page.getSize();
      page.drawText(stamp.text, { x: stamp.x, y: height - (stamp.yTop - 0.207 * size), size, font, color: rgb(0, 0, 0) });
    }
    result[position] = { ...attachment, contentType: 'application/pdf', content: Buffer.from(await doc.save({ updateFieldAppearances: false })) };
  }
  return result;
}
