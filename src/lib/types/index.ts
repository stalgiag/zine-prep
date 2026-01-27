export interface ProcessingProgress {
  stage: 'idle' | 'loading' | 'processing' | 'composing' | 'saving' | 'complete' | 'error';
  percent: number;
  message: string;
}

export interface ImpositionPage {
  left: number | null;  // null means blank page
  right: number | null;
}

export interface ImpositionSheet {
  front: ImpositionPage;
  back: ImpositionPage;
}

export interface ImpositionLayout {
  sheets: ImpositionSheet[];
  totalPages: number;
  paddedPages: number;
}

// Progress callback type
export type ProgressCallback = (progress: ProcessingProgress) => void;

// Validation result for format processors
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// Format processor interface - each format implements this
export interface FormatProcessor {
  id: string;
  name: string;
  description: string;
  inputDescription: string;   // e.g., "8-page linear PDF"
  outputSuffix: string;       // e.g., "-mini" for filename
  printInstructions: string;  // Instructions shown after processing
  process: (data: ArrayBuffer, onProgress?: ProgressCallback) => Promise<Uint8Array>;
  validate?: (pageCount: number) => ValidationResult;
}

// Tool definition for UI
export interface Tool {
  id: string;
  name: string;
  tagline: string;
  description: string;
}

// Application state
export type AppState = 'selecting' | 'uploading' | 'processing' | 'complete' | 'error';
