import { PDFDocument, degrees } from 'pdf-lib';
import { calculateImposition } from './imposition';
import type { ProcessingProgress } from '../types';

// US Letter dimensions in points (72 points = 1 inch)
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

// Landscape orientation for output
const OUTPUT_WIDTH = LETTER_HEIGHT;   // 792 points (11")
const OUTPUT_HEIGHT = LETTER_WIDTH;   // 612 points (8.5")
const HALF_WIDTH = OUTPUT_WIDTH / 2;  // 396 points (5.5")

export type ProgressCallback = (progress: ProcessingProgress) => void;

/**
 * Creates an imposed PDF for saddle-stitch booklet printing.
 * Takes a linear PDF and arranges pages for duplex printing.
 */
export async function createImposedPdf(
  sourceData: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const updateProgress = (stage: ProcessingProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  // Stage 1: Loading
  updateProgress('loading', 10, 'Loading PDF...');
  const sourcePdf = await PDFDocument.load(sourceData);
  const pageCount = sourcePdf.getPageCount();

  if (pageCount === 0) {
    throw new Error('The PDF contains no pages');
  }

  updateProgress('loading', 25, `Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`);

  // Stage 2: Processing (calculating layout)
  updateProgress('processing', 30, 'Calculating imposition layout...');
  const layout = calculateImposition(pageCount);

  updateProgress('processing', 40, `Creating ${layout.sheets.length} sheet${layout.sheets.length > 1 ? 's' : ''} (${layout.paddedPages} pages)`);

  // Stage 3: Composing
  updateProgress('composing', 45, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  // Copy all pages from source for embedding
  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  const totalSides = layout.sheets.length * 2;
  let currentSide = 0;

  for (const sheet of layout.sheets) {
    // Process front side
    await addImposedPage(outputPdf, embeddedPages, sheet.front.left, sheet.front.right);
    currentSide++;
    const frontPercent = 45 + (currentSide / totalSides) * 40;
    updateProgress('composing', frontPercent, `Composing sheet ${Math.ceil(currentSide / 2)} front...`);

    // Process back side
    await addImposedPage(outputPdf, embeddedPages, sheet.back.left, sheet.back.right);
    currentSide++;
    const backPercent = 45 + (currentSide / totalSides) * 40;
    updateProgress('composing', backPercent, `Composing sheet ${Math.ceil(currentSide / 2)} back...`);
  }

  // Stage 4: Saving
  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

/**
 * Adds a single imposed page (landscape, 2-up) to the output PDF.
 * leftPageNum and rightPageNum are 1-indexed; null means blank.
 */
async function addImposedPage(
  outputPdf: PDFDocument,
  embeddedPages: Awaited<ReturnType<PDFDocument['embedPdf']>>,
  leftPageNum: number | null,
  rightPageNum: number | null
): Promise<void> {
  const page = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);

  // Draw left page (if not blank)
  if (leftPageNum !== null) {
    const sourcePageIndex = leftPageNum - 1;
    const embeddedPage = embeddedPages[sourcePageIndex];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    // Scale to fit in half-width while maintaining aspect ratio
    const scale = Math.min(HALF_WIDTH / srcWidth, OUTPUT_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    // Center in left half
    const x = (HALF_WIDTH - scaledWidth) / 2;
    const y = (OUTPUT_HEIGHT - scaledHeight) / 2;

    page.drawPage(embeddedPage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  }

  // Draw right page (if not blank)
  if (rightPageNum !== null) {
    const sourcePageIndex = rightPageNum - 1;
    const embeddedPage = embeddedPages[sourcePageIndex];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    // Scale to fit in half-width while maintaining aspect ratio
    const scale = Math.min(HALF_WIDTH / srcWidth, OUTPUT_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    // Center in right half
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
