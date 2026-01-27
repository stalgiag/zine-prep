import type { FormatProcessor, Tool } from '../../types';
import { saddleStitchProcessor } from './saddle-stitch';
import { unImposeProcessor } from './un-impose';
import { miniZineProcessor } from './mini-zine';
import { halfFoldProcessor } from './half-fold';
import { quarterBookletProcessor } from './quarter-booklet';
import { twoUpProofProcessor } from './two-up-proof';
import { accordionProcessor } from './accordion';

// All available format processors
export const formatProcessors: FormatProcessor[] = [
  saddleStitchProcessor,
  unImposeProcessor,
  miniZineProcessor,
  halfFoldProcessor,
  quarterBookletProcessor,
  twoUpProofProcessor,
  accordionProcessor,
];

// Map of processor ID to processor for quick lookup
export const processorMap: Map<string, FormatProcessor> = new Map(
  formatProcessors.map(p => [p.id, p])
);

// Get processor by ID
export function getProcessor(id: string): FormatProcessor | undefined {
  return processorMap.get(id);
}

// Tool definitions for UI (derived from processors)
export const tools: Tool[] = formatProcessors.map(p => ({
  id: p.id,
  name: p.name,
  tagline: p.inputDescription,
  description: p.description,
}));

// Re-export all processors for direct imports if needed
export {
  saddleStitchProcessor,
  unImposeProcessor,
  miniZineProcessor,
  halfFoldProcessor,
  quarterBookletProcessor,
  twoUpProofProcessor,
  accordionProcessor,
};
