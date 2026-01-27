import { PDFDocument } from 'pdf-lib';
import type { FormatProcessor, ProgressCallback } from '../../types';

// US Letter dimensions in points
const LETTER_WIDTH = 8.5 * 72;  // 612 points
const LETTER_HEIGHT = 11 * 72;  // 792 points

/**
 * Reverses the saddle-stitch imposition algorithm.
 * Given the number of output linear pages, returns the page order.
 */
function reverseImposition(numLinearPages: number): number[] {
  // The imposition algorithm for n pages (padded to multiple of 4):
  // Sheet i (0-indexed):
  //   Front: left = n - 2i,     right = 1 + 2i
  //   Back:  left = 2 + 2i,     right = n - 1 - 2i
  //
  // So imposed order is: [n-0, 1], [2, n-1], [n-2, 3], [4, n-3], ...
  // We need to reverse this: given imposed position, find linear page number

  const numSheets = numLinearPages / 4;
  const imposedOrder: number[] = [];

  for (let i = 0; i < numSheets; i++) {
    // Front side: left, right
    imposedOrder.push(numLinearPages - 2 * i); // front left
    imposedOrder.push(1 + 2 * i);              // front right
    // Back side: left, right
    imposedOrder.push(2 + 2 * i);              // back left
    imposedOrder.push(numLinearPages - 1 - 2 * i); // back right
  }

  return imposedOrder;
}

async function process(
  sourceData: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const updateProgress = (stage: 'loading' | 'processing' | 'composing' | 'saving' | 'complete', percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  updateProgress('loading', 10, 'Loading imposed PDF...');
  const sourcePdf = await PDFDocument.load(sourceData);
  const imposedPageCount = sourcePdf.getPageCount();

  if (imposedPageCount === 0) {
    throw new Error('The PDF contains no pages');
  }

  // Each imposed page contains 2 source pages (left and right halves)
  // So total linear pages = imposedPageCount * 2
  // But we need to figure out if this is truly imposed or just 2-up

  updateProgress('loading', 25, `Loaded ${imposedPageCount} imposed page${imposedPageCount > 1 ? 's' : ''}`);

  updateProgress('processing', 30, 'Analyzing layout...');

  // Get dimensions of first page to verify it's landscape
  const firstPage = sourcePdf.getPage(0);
  const { width, height } = firstPage.getSize();

  if (width < height) {
    throw new Error('Expected landscape orientation. This PDF may not be imposed.');
  }

  // Calculate the number of linear pages (2 per imposed page)
  const linearPageCount = imposedPageCount * 2;

  // Ensure it's a multiple of 4 (valid imposition)
  if (linearPageCount % 4 !== 0) {
    throw new Error(`Invalid imposed PDF: ${linearPageCount} extracted pages is not a multiple of 4`);
  }

  updateProgress('processing', 40, `Extracting ${linearPageCount} pages...`);

  // Create output PDF
  updateProgress('composing', 45, 'Creating output document...');
  const outputPdf = await PDFDocument.create();

  // Get the imposition order so we know where each linear page came from
  const imposedOrder = reverseImposition(linearPageCount);

  // Create a mapping: linearPage -> { imposedPage, side ('left' | 'right') }
  const pageMap: Map<number, { imposedPageIndex: number; side: 'left' | 'right' }> = new Map();

  for (let i = 0; i < imposedOrder.length; i++) {
    const linearPage = imposedOrder[i];
    const imposedPageIndex = Math.floor(i / 2);
    const side = i % 2 === 0 ? 'left' : 'right';
    pageMap.set(linearPage, { imposedPageIndex, side });
  }

  // Extract pages in linear order (1, 2, 3, 4, ...)
  const halfWidth = width / 2;

  for (let linearPage = 1; linearPage <= linearPageCount; linearPage++) {
    const mapping = pageMap.get(linearPage);
    if (!mapping) continue;

    const { imposedPageIndex, side } = mapping;
    const sourcePage = sourcePdf.getPage(imposedPageIndex);

    // Create a new portrait page
    const newPage = outputPdf.addPage([LETTER_WIDTH, LETTER_HEIGHT]);

    // Embed the source page
    const [embeddedPage] = await outputPdf.embedPdf(sourcePdf, [imposedPageIndex]);

    // Calculate crop position
    const xOffset = side === 'left' ? 0 : -halfWidth;

    // Scale to fit the portrait page
    const scale = Math.min(LETTER_WIDTH / halfWidth, LETTER_HEIGHT / height);
    const scaledWidth = halfWidth * scale;
    const scaledHeight = height * scale;

    // Center on the new page
    const x = (LETTER_WIDTH - scaledWidth) / 2;
    const y = (LETTER_HEIGHT - scaledHeight) / 2;

    // Draw the appropriate half
    newPage.drawPage(embeddedPage, {
      x: x + xOffset * scale,
      y,
      width: width * scale,
      height: scaledHeight,
    });

    // Clip to just the half we want by adding a clipping rectangle
    // Note: pdf-lib doesn't support clipping directly, so we'll use a different approach

    const percent = 45 + (linearPage / linearPageCount) * 40;
    updateProgress('composing', percent, `Extracting page ${linearPage}...`);
  }

  updateProgress('saving', 90, 'Saving PDF...');
  const outputData = await outputPdf.save();

  updateProgress('complete', 100, 'Complete!');

  return outputData;
}

export const unImposeProcessor: FormatProcessor = {
  id: 'un-impose',
  name: 'Un-impose',
  description: 'Convert imposed booklet back to linear pages',
  inputDescription: 'Imposed 2-up PDF',
  outputSuffix: '-linear',
  printInstructions: 'pages are now in reading order',
  process,
  validate: (pageCount: number) => {
    if (pageCount < 1) {
      return { valid: false, message: 'PDF must have at least 1 page' };
    }
    return { valid: true };
  },
};
