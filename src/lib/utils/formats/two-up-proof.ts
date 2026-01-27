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
 * 2-Up Proof: Simple side-by-side pages for proofing spreads.
 * No imposition logic - just places consecutive pages next to each other.
 *
 * Output: [1|2], [3|4], [5|6], etc.
 * Odd-page PDFs will have the last page alone on the left.
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

  updateProgress('loading', 25, `Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`);

  updateProgress('processing', 30, 'Calculating 2-up layout...');

  const spreadCount = Math.ceil(pageCount / 2);

  updateProgress('processing', 40, `Creating ${spreadCount} spread${spreadCount > 1 ? 's' : ''}`);

  updateProgress('composing', 45, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Helper to draw a page in a half position
  const drawHalf = (
    outputPage: ReturnType<typeof outputPdf.addPage>,
    pageIndex: number,
    position: 'left' | 'right'
  ) => {
    if (pageIndex >= pageCount) return;

    const embeddedPage = embeddedPages[pageIndex];
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

  // Create spreads: [0,1], [2,3], [4,5], etc.
  for (let spread = 0; spread < spreadCount; spread++) {
    const leftPageIndex = spread * 2;
    const rightPageIndex = spread * 2 + 1;

    const outputPage = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);

    drawHalf(outputPage, leftPageIndex, 'left');
    if (rightPageIndex < pageCount) {
      drawHalf(outputPage, rightPageIndex, 'right');
    }

    const percent = 45 + ((spread + 1) / spreadCount) * 40;
    updateProgress('composing', percent, `Creating spread ${spread + 1}...`);
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const twoUpProofProcessor: FormatProcessor = {
  id: 'two-up-proof',
  name: '2-Up Proof',
  description: 'Side-by-side pages for proofing',
  inputDescription: 'Any PDF',
  outputSuffix: '-2up',
  printInstructions: 'print for spread review',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    return { valid: true };
  },
};
