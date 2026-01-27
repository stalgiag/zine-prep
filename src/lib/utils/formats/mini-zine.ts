import { PDFDocument, degrees } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback } from '../../types';

// US Letter dimensions in points
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

// Mini zine panel size (1/8 of a letter sheet)
// Sheet is divided into 4 columns x 2 rows
const PANEL_WIDTH = LETTER_WIDTH / 4;   // 153 points
const PANEL_HEIGHT = LETTER_HEIGHT / 2; // 396 points

/**
 * Mini zine (8-page) layout:
 * Classic single-sheet mini zine with one horizontal cut
 *
 * Standard mini-zine panel arrangement:
 * Front of sheet (looking at it):
 *   [4↓][5][8↓][1]
 * Back of sheet (flip on long edge):
 *   [2][7↓][6][3↓]
 *
 * Where ↓ means rotated 180°
 *
 * After printing duplex (flip on long edge):
 * 1. Fold in half lengthwise (hamburger fold)
 * 2. Fold in half widthwise (hotdog fold)
 * 3. Open and cut along center horizontal line from fold to fold
 * 4. Fold into booklet
 */

interface PanelPosition {
  col: number;  // 0-3 from left
  row: number;  // 0 = bottom, 1 = top
  rotate: boolean;
}

// Front side panel positions (page numbers are 1-indexed)
const FRONT_LAYOUT: Record<number, PanelPosition> = {
  4: { col: 0, row: 1, rotate: true },
  5: { col: 1, row: 1, rotate: false },
  8: { col: 2, row: 1, rotate: true },
  1: { col: 3, row: 1, rotate: false },
};

// Back side panel positions
const BACK_LAYOUT: Record<number, PanelPosition> = {
  2: { col: 0, row: 1, rotate: false },
  7: { col: 1, row: 1, rotate: true },
  6: { col: 2, row: 1, rotate: false },
  3: { col: 3, row: 1, rotate: true },
};

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
    throw new Error('Mini zine requires exactly 8 pages (or fewer to pad with blanks)');
  }

  updateProgress('loading', 25, `Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`);

  updateProgress('processing', 30, 'Calculating mini zine layout...');

  // Pad to 8 pages if needed
  const paddedCount = 8;

  updateProgress('composing', 40, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  // Embed all source pages
  const embeddedPages = await outputPdf.embedPdf(sourcePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Create front side (landscape orientation for easier folding reference)
  const frontPage = outputPdf.addPage([LETTER_WIDTH, LETTER_HEIGHT]);

  // Draw front side panels
  for (const [pageNumStr, pos] of Object.entries(FRONT_LAYOUT)) {
    const pageNum = parseInt(pageNumStr);
    if (pageNum > pageCount) continue; // Skip blank pages

    const embeddedPage = embeddedPages[pageNum - 1];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    // Scale to fit panel
    const scale = Math.min(PANEL_WIDTH / srcWidth, PANEL_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    // Calculate position
    const panelX = pos.col * PANEL_WIDTH;
    const panelY = pos.row * PANEL_HEIGHT;

    // Center in panel
    let x = panelX + (PANEL_WIDTH - scaledWidth) / 2;
    let y = panelY + (PANEL_HEIGHT - scaledHeight) / 2;

    if (pos.rotate) {
      // For 180° rotation, we need to adjust the position
      frontPage.drawPage(embeddedPage, {
        x: x + scaledWidth,
        y: y + scaledHeight,
        width: scaledWidth,
        height: scaledHeight,
        rotate: degrees(180),
      });
    } else {
      frontPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
  }

  updateProgress('composing', 70, 'Creating back side...');

  // Create back side
  const backPage = outputPdf.addPage([LETTER_WIDTH, LETTER_HEIGHT]);

  // Draw back side panels
  for (const [pageNumStr, pos] of Object.entries(BACK_LAYOUT)) {
    const pageNum = parseInt(pageNumStr);
    if (pageNum > pageCount) continue;

    const embeddedPage = embeddedPages[pageNum - 1];
    const { width: srcWidth, height: srcHeight } = embeddedPage;

    const scale = Math.min(PANEL_WIDTH / srcWidth, PANEL_HEIGHT / srcHeight);
    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const panelX = pos.col * PANEL_WIDTH;
    const panelY = pos.row * PANEL_HEIGHT;

    let x = panelX + (PANEL_WIDTH - scaledWidth) / 2;
    let y = panelY + (PANEL_HEIGHT - scaledHeight) / 2;

    if (pos.rotate) {
      backPage.drawPage(embeddedPage, {
        x: x + scaledWidth,
        y: y + scaledHeight,
        width: scaledWidth,
        height: scaledHeight,
        rotate: degrees(180),
      });
    } else {
      backPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const miniZineProcessor: FormatProcessor = {
  id: 'mini-zine',
  name: 'Mini Zine',
  description: 'Classic 8-page single-sheet zine',
  inputDescription: '8-page PDF (or fewer)',
  outputSuffix: '-mini',
  printInstructions: 'print duplex (flip long edge) / fold lengthwise / fold widthwise / cut center slit / fold into booklet',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    if (pageCount > 8) {
      return { valid: false, message: 'Mini zine supports maximum 8 pages' };
    }
    return { valid: true };
  },
};
