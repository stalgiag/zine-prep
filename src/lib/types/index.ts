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
