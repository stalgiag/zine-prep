import { PDFDocument } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback, ImpositionLayout, ImpositionSheet } from '../../types';

// US Letter dimensions in points
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

// Portrait output with 4-up (2x2 grid)
const OUTPUT_WIDTH = LETTER_WIDTH;
const OUTPUT_HEIGHT = LETTER_HEIGHT;

// Each mini page takes up 1/4 of the sheet
const QUARTER_WIDTH = OUTPUT_WIDTH / 2;   // 306 points
const QUARTER_HEIGHT = OUTPUT_HEIGHT / 2; // 396 points

// Within each quarter, landscape orientation for the mini booklet
const MINI_PAGE_WIDTH = QUARTER_HEIGHT;  // 396 points
const MINI_PAGE_HEIGHT = QUARTER_WIDTH;   // 306 points
const MINI_HALF_WIDTH = MINI_PAGE_WIDTH / 2;

/**
 * Quarter-size booklet: Same as saddle-stitch but 4-up (2x2 grid)
 * Creates pocket-sized zines from a single sheet.
 *
 * Each sheet contains 4 mini-pages in a 2x2 grid.
 * Cut the sheet into quarters, then each quarter is a mini saddle-stitch booklet.
 */

function padToMultipleOf4(pageCount: number): number {
  return Math.ceil(pageCount / 4) * 4;
}

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

  updateProgress('processing', 30, 'Calculating quarter-booklet layout...');
  const layout = calculateImposition(pageCount);

  // For quarter booklet, we put 4 mini-spreads per physical sheet
  // So we need layout.sheets.length / 2 physical sheets (since each physical sheet = 2 mini sheets)
  // Actually: each mini booklet sheet has front and back (2 sides x 2 pages = 4 mini pages)
  // Physical sheet has 4 quadrants, so 2 mini sheets per physical side

  const miniSheetCount = layout.sheets.length;
  const physicalSheetCount = Math.ceil(miniSheetCount / 2);

  updateProgress('processing', 40, `Creating ${physicalSheetCount} physical sheet${physicalSheetCount > 1 ? 's' : ''} for ${layout.paddedPages} mini pages`);

  updateProgress('composing', 45, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Helper to draw a mini page in a quadrant
  const drawMiniPage = (
    outputPage: ReturnType<typeof outputPdf.addPage>,
    pageNum: number | null,
    quadrant: 'TL' | 'TR' | 'BL' | 'BR',
    position: 'left' | 'right'
  ) => {
    if (pageNum === null) return;

    const embeddedPage = embeddedPages[pageNum - 1];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    // Scale to fit in half of a quarter (since each quarter has 2 mini pages side by side)
    const scale = Math.min(MINI_HALF_WIDTH / srcWidth, MINI_PAGE_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    // Calculate quadrant base position
    let quadX = 0;
    let quadY = 0;

    switch (quadrant) {
      case 'TL': quadX = 0; quadY = QUARTER_HEIGHT; break;
      case 'TR': quadX = QUARTER_WIDTH; quadY = QUARTER_HEIGHT; break;
      case 'BL': quadX = 0; quadY = 0; break;
      case 'BR': quadX = QUARTER_WIDTH; quadY = 0; break;
    }

    // Within the quadrant, position left or right (the quadrant is landscape oriented for the mini booklet)
    const halfOffset = position === 'left' ? 0 : MINI_HALF_WIDTH;

    // Center in the half-quadrant
    // Note: we're working in a rotated space conceptually, but just positioning for now
    const x = quadX + (position === 'left' ? 0 : QUARTER_WIDTH / 2) + (QUARTER_WIDTH / 2 - scaledWidth) / 2;
    const y = quadY + (QUARTER_HEIGHT - scaledHeight) / 2;

    outputPage.drawPage(embeddedPage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  };

  // Create physical sheets
  // Each physical sheet front has 2 mini-sheet fronts (top and bottom halves)
  // Each physical sheet back has 2 mini-sheet backs

  for (let physSheet = 0; physSheet < physicalSheetCount; physSheet++) {
    const frontPage = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);
    const backPage = outputPdf.addPage([OUTPUT_WIDTH, OUTPUT_HEIGHT]);

    // Mini sheet indices for this physical sheet
    const miniSheet1Idx = physSheet * 2;
    const miniSheet2Idx = physSheet * 2 + 1;

    // First mini sheet (top half of physical sheet)
    if (miniSheet1Idx < layout.sheets.length) {
      const sheet1 = layout.sheets[miniSheet1Idx];
      // Front of mini sheet 1 goes in top half of front
      drawMiniPage(frontPage, sheet1.front.left, 'TL', 'left');
      drawMiniPage(frontPage, sheet1.front.right, 'TL', 'right');
      // Back of mini sheet 1 goes in top half of back
      drawMiniPage(backPage, sheet1.back.left, 'TL', 'left');
      drawMiniPage(backPage, sheet1.back.right, 'TL', 'right');
    }

    // Second mini sheet (bottom half of physical sheet)
    if (miniSheet2Idx < layout.sheets.length) {
      const sheet2 = layout.sheets[miniSheet2Idx];
      // Front of mini sheet 2 goes in bottom half of front
      drawMiniPage(frontPage, sheet2.front.left, 'BL', 'left');
      drawMiniPage(frontPage, sheet2.front.right, 'BL', 'right');
      // Back of mini sheet 2 goes in bottom half of back
      drawMiniPage(backPage, sheet2.back.left, 'BL', 'left');
      drawMiniPage(backPage, sheet2.back.right, 'BL', 'right');
    }

    const percent = 45 + ((physSheet + 1) / physicalSheetCount) * 40;
    updateProgress('composing', percent, `Composing physical sheet ${physSheet + 1}...`);
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const quarterBookletProcessor: FormatProcessor = {
  id: 'quarter-booklet',
  name: 'Quarter Size',
  description: 'Pocket-size saddle-stitch booklet (4-up)',
  inputDescription: 'Any PDF',
  outputSuffix: '-quarter',
  printInstructions: 'print duplex (flip short edge) / cut into quarters / fold each quarter / staple',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    return { valid: true };
  },
};
