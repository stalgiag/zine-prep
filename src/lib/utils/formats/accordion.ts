import { PDFDocument, degrees } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback } from '../../types';

// US Letter dimensions in points
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

/**
 * Accordion Fold (Z-fold) layout
 *
 * Pages are laid out in a continuous strip for accordion/z-fold printing.
 * Alternating pages are rotated 180° so they read correctly when folded.
 *
 * For 4 pages on a single sheet (landscape):
 * Front: [1][2↓][3][4↓]
 * Back:  (if needed for more pages)
 *
 * For more pages, multiple sheets are created.
 * Maximum 8 pages per sheet (4 panels front, 4 panels back).
 */

const MAX_PANELS_PER_SIDE = 4;
const MAX_PAGES_PER_SHEET = MAX_PANELS_PER_SIDE * 2;

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

  if (pageCount > 8) {
    throw new Error('Accordion fold supports maximum 8 pages');
  }

  updateProgress('loading', 25, `Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`);

  updateProgress('processing', 30, 'Calculating accordion layout...');

  // Determine panel count and output width
  const panelsPerSide = Math.min(pageCount, MAX_PANELS_PER_SIDE);
  const panelWidth = LETTER_WIDTH / panelsPerSide;
  const outputWidth = LETTER_WIDTH;
  const outputHeight = LETTER_HEIGHT;

  updateProgress('composing', 40, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Helper to draw a page in a panel
  const drawPanel = (
    outputPage: ReturnType<typeof outputPdf.addPage>,
    pageIndex: number,
    panelIndex: number,
    totalPanels: number,
    rotate: boolean
  ) => {
    if (pageIndex >= pageCount) return;

    const embeddedPage = embeddedPages[pageIndex];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    const panelW = outputWidth / totalPanels;

    // Scale to fit panel
    const scale = Math.min(panelW / srcWidth, outputHeight / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const panelX = panelIndex * panelW;

    // Center in panel
    let x = panelX + (panelW - scaledWidth) / 2;
    let y = (outputHeight - scaledHeight) / 2;

    if (rotate) {
      outputPage.drawPage(embeddedPage, {
        x: x + scaledWidth,
        y: y + scaledHeight,
        width: scaledWidth,
        height: scaledHeight,
        rotate: degrees(180),
      });
    } else {
      outputPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
  };

  // Determine layout based on page count
  if (pageCount <= 4) {
    // Single-sided accordion: all pages on front
    const frontPage = outputPdf.addPage([outputWidth, outputHeight]);

    for (let i = 0; i < pageCount; i++) {
      // Alternate rotation for accordion fold
      const rotate = i % 2 === 1;
      drawPanel(frontPage, i, i, pageCount, rotate);
    }

    updateProgress('composing', 80, 'Created single-sheet accordion');
  } else {
    // Double-sided accordion: pages 1-4 on front, pages 5-8 on back
    const frontPage = outputPdf.addPage([outputWidth, outputHeight]);
    const backPage = outputPdf.addPage([outputWidth, outputHeight]);

    // Front side: pages 1-4 (indices 0-3)
    for (let i = 0; i < Math.min(4, pageCount); i++) {
      const rotate = i % 2 === 1;
      drawPanel(frontPage, i, i, 4, rotate);
    }

    updateProgress('composing', 60, 'Creating back side...');

    // Back side: pages 5-8 (indices 4-7)
    // Note: back panels are in reverse order for proper folding
    const backPanelCount = pageCount - 4;
    for (let i = 0; i < backPanelCount; i++) {
      const pageIndex = 4 + i;
      // Panels on back are reversed: rightmost first
      const panelPosition = backPanelCount - 1 - i;
      // Also alternate rotation, but starting pattern may differ
      const rotate = i % 2 === 0;
      drawPanel(backPage, pageIndex, panelPosition, backPanelCount, rotate);
    }

    updateProgress('composing', 80, 'Created double-sided accordion');
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const accordionProcessor: FormatProcessor = {
  id: 'accordion',
  name: 'Accordion',
  description: 'Z-fold continuous strip layout',
  inputDescription: '4-8 page PDF',
  outputSuffix: '-accordion',
  printInstructions: 'print duplex (if 5+ pages) / cut if multiple strips / fold accordion-style',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    if (pageCount > 8) {
      return { valid: false, message: 'Accordion fold supports maximum 8 pages' };
    }
    return { valid: true };
  },
};
