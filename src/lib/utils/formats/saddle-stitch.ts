import { PDFDocument } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback, ImpositionLayout, ImpositionSheet } from '../../types';

// US Letter dimensions in points (72 points = 1 inch)
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

// Landscape orientation for output
const OUTPUT_WIDTH = LETTER_HEIGHT;   // 792 points (11")
const OUTPUT_HEIGHT = LETTER_WIDTH;   // 612 points (8.5")
const HALF_WIDTH = OUTPUT_WIDTH / 2;  // 396 points (5.5")

/**
 * Pads a page count to the nearest multiple of 4
 * (required for saddle-stitch booklet)
 */
function padToMultipleOf4(pageCount: number): number {
  return Math.ceil(pageCount / 4) * 4;
}

/**
 * Generates the imposition layout for saddle-stitch booklet printing.
 */
function calculateImposition(originalPageCount: number): ImpositionLayout {
  const paddedPages = padToMultipleOf4(originalPageCount);
  const numSheets = paddedPages / 4;
  const sheets: ImpositionSheet[] = [];

  for (let i = 0; i < numSheets; i++) {
    const frontLeft = paddedPages - 2 * i;
    const frontRight = 1 + 2 * i;
    const backLeft = 2 + 2 * i;
    const backRight = paddedPages - 1 - 2 * i;

    sheets.push({
      front: {
        left: frontLeft <= originalPageCount ? frontLeft : null,
        right: frontRight <= originalPageCount ? frontRight : null,
      },
      back: {
        left: backLeft <= originalPageCount ? backLeft : null,
        right: backRight <= originalPageCount ? backRight : null,
      },
    });
  }

  return {
    sheets,
    totalPages: originalPageCount,
    paddedPages,
  };
}

/**
 * Adds a single imposed page (landscape, 2-up) to the output PDF.
 */
async function addImposedPage(
  outputPdf: PDFDocument,
  embeddedPages: Awaited<ReturnType<PDFDocument['embedPdf']>>,
  leftPageNum: number | null,
  rightPageNum: number | null
): Promise<void> {
  const page = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);

  if (leftPageNum !== null) {
    const sourcePageIndex = leftPageNum - 1;
    const embeddedPage = embeddedPages[sourcePageIndex];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    const scale = Math.min(HALF_WIDTH / srcWidth, OUTPUT_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const x = (HALF_WIDTH - scaledWidth) / 2;
    const y = (OUTPUT_HEIGHT - scaledHeight) / 2;

    page.drawPage(embeddedPage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  }

  if (rightPageNum !== null) {
    const sourcePageIndex = rightPageNum - 1;
    const embeddedPage = embeddedPages[sourcePageIndex];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    const scale = Math.min(HALF_WIDTH / srcWidth, OUTPUT_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const x = HALF_WIDTH + (HALF_WIDTH - scaledWidth) / 2;
    const y = (OUTPUT_HEIGHT - scaledHeight) / 2;

    page.drawPage(embeddedPage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  }
}

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

  updateProgress('processing', 30, 'Calculating imposition layout...');
  const layout = calculateImposition(pageCount);

  updateProgress('processing', 40, `Creating ${layout.sheets.length} sheet${layout.sheets.length > 1 ? 's' : ''} (${layout.paddedPages} pages)`);

  updateProgress('composing', 45, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  const totalSides = layout.sheets.length * 2;
  let currentSide = 0;

  for (const sheet of layout.sheets) {
    await addImposedPage(outputPdf, embeddedPages, sheet.front.left, sheet.front.right);
    currentSide++;
    const frontPercent = 45 + (currentSide / totalSides) * 40;
    updateProgress('composing', frontPercent, `Composing sheet ${Math.ceil(currentSide / 2)} front...`);

    await addImposedPage(outputPdf, embeddedPages, sheet.back.left, sheet.back.right);
    currentSide++;
    const backPercent = 45 + (currentSide / totalSides) * 40;
    updateProgress('composing', backPercent, `Composing sheet ${Math.ceil(currentSide / 2)} back...`);
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const saddleStitchProcessor: FormatProcessor = {
  id: 'saddle-stitch',
  name: 'Booklet',
  description: 'Saddle-stitch booklet imposition',
  inputDescription: 'Any PDF',
  outputSuffix: '-imposed',
  printInstructions: 'print duplex / flip short edge / fold / staple',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    return { valid: true };
  },
};
