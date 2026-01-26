import type { ImpositionLayout, ImpositionSheet } from '../types';

/**
 * Pads a page count to the nearest multiple of 4
 * (required for saddle-stitch booklet)
 */
export function padToMultipleOf4(pageCount: number): number {
  return Math.ceil(pageCount / 4) * 4;
}

/**
 * Generates the imposition layout for saddle-stitch booklet printing.
 *
 * For n pages (padded to multiple of 4):
 * Sheet i (0-indexed):
 *   Front: left = n - 2i,     right = 1 + 2i
 *   Back:  left = 2 + 2i,     right = n - 1 - 2i
 *
 * Page numbers are 1-indexed in the output.
 * Pages beyond the original count are marked as null (blank).
 */
export function calculateImposition(originalPageCount: number): ImpositionLayout {
  const paddedPages = padToMultipleOf4(originalPageCount);
  const numSheets = paddedPages / 4;
  const sheets: ImpositionSheet[] = [];

  for (let i = 0; i < numSheets; i++) {
    // Calculate page numbers (1-indexed)
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
