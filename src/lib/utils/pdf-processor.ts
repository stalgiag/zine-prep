import type { ProgressCallback, FormatProcessor } from '../types';
import { getProcessor, formatProcessors } from './formats';

// Re-export for backwards compatibility
export type { ProgressCallback };

// Re-export format utilities
export { formatProcessors, getProcessor };

/**
 * Process a PDF using the specified format processor.
 */
export async function processPdf(
  formatId: string,
  sourceData: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const processor = getProcessor(formatId);

  if (!processor) {
    throw new Error(`Unknown format: ${formatId}`);
  }

  return processor.process(sourceData, onProgress);
}

/**
 * Legacy function for backwards compatibility.
 * Creates an imposed PDF for saddle-stitch booklet printing.
 */
export async function createImposedPdf(
  sourceData: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  return processPdf('saddle-stitch', sourceData, onProgress);
}
