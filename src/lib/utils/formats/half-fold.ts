import { PDFDocument } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback } from '../../types';

// US Letter dimensions in points
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

// Landscape orientation for output
const OUTPUT_WIDTH = LETTER_HEIGHT;   // 792 points (11")
const OUTPUT_HEIGHT = LETTER_WIDTH;   // 612 points (8.5")
const HALF_WIDTH = OUTPUT_WIDTH / 2;  // 396 points (5.5")

/**
 * Half-fold (4-page bi-fold card/pamphlet)
 *
 * Input: 4 pages in reading order (1=cover, 2=inside left, 3=inside right, 4=back)
 *
 * Output (landscape):
 * Front sheet: [4 | 1]  (back cover on left, front cover on right)
 * Back sheet:  [2 | 3]  (inside spread)
 *
 * Print duplex, fold in half to create a simple bi-fold card.
 */

async function process(
  sourceData: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const updateProgress = (stage: 'loading' | 'processing' | 'composing' | 'saving' | 'complete', percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  updateProgress('loading', 10, 'Loading PDF...');
  const sourcePdf = await PDFDocument.load(sourceData);
  const pageCount = sourcePdf.getPageCount();

  if (pageCount === 0) {
    throw new Error('The PDF contains no pages');
  }

  if (pageCount > 4) {
    throw new Error('Half-fold requires exactly 4 pages (or fewer to pad with blanks)');
  }

  updateProgress('loading', 25, `Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`);

  updateProgress('processing', 30, 'Calculating half-fold layout...');

  updateProgress('composing', 40, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  // Embed all source pages
  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Helper to draw a page in a half position
  const drawHalf = (
    outputPage: ReturnType<typeof outputPdf.addPage>,
    pageNum: number | null,
    position: 'left' | 'right'
  ) => {
    if (pageNum === null || pageNum > pageCount) return;

    const embeddedPage = embeddedPages[pageNum - 1];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    const scale = Math.min(HALF_WIDTH / srcWidth, OUTPUT_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const xBase = position === 'left' ? 0 : HALF_WIDTH;
    const x = xBase + (HALF_WIDTH - scaledWidth) / 2;
    const y = (OUTPUT_HEIGHT - scaledHeight) / 2;

    outputPage.drawPage(embeddedPage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  };

  // Front sheet: page 4 (left) + page 1 (right)
  const frontSheet = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);
  drawHalf(frontSheet, 4, 'left');
  drawHalf(frontSheet, 1, 'right');

  updateProgress('composing', 70, 'Creating inside spread...');

  // Back sheet: page 2 (left) + page 3 (right)
  const backSheet = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);
  drawHalf(backSheet, 2, 'left');
  drawHalf(backSheet, 3, 'right');

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const halfFoldProcessor: FormatProcessor = {
  id: 'half-fold',
  name: 'Half-Fold',
  description: 'Simple 4-page bi-fold card',
  inputDescription: '4-page PDF',
  outputSuffix: '-halffold',
  printInstructions: 'print duplex (flip short edge) / fold in half',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    if (pageCount > 4) {
      return { valid: false, message: 'Half-fold supports maximum 4 pages' };
    }
    return { valid: true };
  },
};
