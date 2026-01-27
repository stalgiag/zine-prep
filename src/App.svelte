<script lang="ts">
  import FileDropzone from './lib/components/FileDropzone.svelte';
  import ProgressIndicator from './lib/components/ProgressIndicator.svelte';
  import DownloadButton from './lib/components/DownloadButton.svelte';
  import ToolSelector from './lib/components/ToolSelector.svelte';
  import { processPdf, getProcessor } from './lib/utils/pdf-processor';
  import type { ProcessingProgress, AppState, Tool } from './lib/types';

  let selectedTool = $state<Tool | null>(null);
  let sourceFile = $state<File | null>(null);
  let outputPdf = $state<Uint8Array | null>(null);
  let error = $state<string | null>(null);
  let progress = $state<ProcessingProgress>({
    stage: 'idle',
    percent: 0,
    message: '',
  });

  let appState: AppState = $derived.by(() => {
    if (!selectedTool) return 'selecting';
    if (!sourceFile) return 'uploading';
    if (progress.stage === 'error') return 'error';
    if (progress.stage === 'complete') return 'complete';
    if (progress.stage !== 'idle') return 'processing';
    return 'uploading';
  });

  let isProcessing = $derived(
    progress.stage !== 'idle' &&
    progress.stage !== 'complete' &&
    progress.stage !== 'error'
  );

  let processor = $derived(selectedTool ? getProcessor(selectedTool.id) : null);

  let outputFilename = $derived.by(() => {
    if (!sourceFile || !processor) return 'output.pdf';
    return sourceFile.name.replace(/\.pdf$/i, `${processor.outputSuffix}.pdf`);
  });

  let printInstructions = $derived(processor?.printInstructions ?? '');

  function handleToolSelect(tool: Tool) {
    selectedTool = tool;
    resetProcessing();
  }

  function handleBackToTools() {
    selectedTool = null;
    resetProcessing();
  }

  async function handleFileSelect(file: File) {
    if (!selectedTool) return;

    sourceFile = file;
    outputPdf = null;
    error = null;

    try {
      const arrayBuffer = await file.arrayBuffer();

      outputPdf = await processPdf(selectedTool.id, arrayBuffer, (p) => {
        progress = p;
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      progress = {
        stage: 'error',
        percent: 0,
        message: error,
      };
    }
  }

  function resetProcessing() {
    sourceFile = null;
    outputPdf = null;
    error = null;
    progress = {
      stage: 'idle',
      percent: 0,
      message: '',
    };
  }

  function handleReset() {
    resetProcessing();
  }

  function handleProcessAnother() {
    handleBackToTools();
  }

  function handleSameToolAgain() {
    resetProcessing();
  }
</script>

<main class="container">
  <header class="header">
    <h1>ZINE PREP</h1>
    <p class="privacy-note">all processing happens in your browser. nothing is uploaded. no data collected.</p>
  </header>

  <div class="box">
    {#if appState === 'selecting'}
      <ToolSelector onSelect={handleToolSelect} />
    {:else if selectedTool}
      <div class="tool-header">
        <button type="button" class="back-btn" onclick={handleBackToTools}>
          &lt; tools
        </button>
        <span class="current-tool">{selectedTool.name}</span>
      </div>

      <div class="divider"></div>

      {#if appState === 'uploading'}
        <FileDropzone onFileSelect={handleFileSelect} disabled={isProcessing} />
        {#if processor?.inputDescription}
          <p class="input-hint">{processor.inputDescription}</p>
        {/if}
      {:else}
        <div class="file-row">
          <span class="filename">{sourceFile?.name}</span>
          <span class="filesize">[{sourceFile ? (sourceFile.size / 1024).toFixed(0) : 0}kb]</span>
        </div>

        <div class="divider"></div>

        <ProgressIndicator {progress} />

        {#if appState === 'complete' && outputPdf}
          <div class="divider"></div>
          <div class="result">
            <DownloadButton pdfData={outputPdf} filename={outputFilename} />
            <div class="result-actions">
              <button type="button" class="text-btn" onclick={handleSameToolAgain}>
                [same tool again]
              </button>
              <button type="button" class="text-btn" onclick={handleProcessAnother}>
                [different tool]
              </button>
            </div>
          </div>
        {/if}

        {#if appState === 'error'}
          <div class="divider"></div>
          <div class="error">
            <p>ERROR: {error}</p>
            <button type="button" class="text-btn" onclick={handleReset}>
              [try again]
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <footer class="footer">
    <div class="footer-text">
      {#if appState === 'complete' && printInstructions}
        <p>{printInstructions}</p>
      {:else if appState === 'selecting'}
        <p>select a tool to get started</p>
      {:else if selectedTool}
        <p>{selectedTool.description}</p>
      {/if}
    </div>
    <a href="https://github.com/stalgiag/zine-prep" class="github-link" target="_blank" rel="noopener" aria-label="GitHub">
      <svg class="github-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"/>
      </svg>
    </a>
  </footer>
</main>

<style>
  .container {
    max-width: 520px;
    margin: 0 auto;
    padding: 4rem 1rem;
  }

  .header {
    margin-bottom: 1.5rem;
  }

  .header h1 {
    font-size: 1.25rem;
    font-weight: normal;
    margin: 0;
    letter-spacing: 0.15em;
  }

  .privacy-note {
    font-size: 0.6875rem;
    color: var(--ink-light);
    margin: 0.5rem 0 0 0;
  }

  .box {
    border: 2px solid var(--ink);
    padding: 1.25rem;
    background: white;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.75rem;
    color: var(--ink-light);
    cursor: pointer;
  }

  .back-btn:hover {
    color: var(--ink);
  }

  .current-tool {
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .file-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .filename {
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .filesize {
    font-size: 0.75rem;
    color: var(--ink-light);
    white-space: nowrap;
  }

  .divider {
    border-top: 1px dashed var(--xerox-gray);
    margin: 1rem 0;
  }

  .input-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.6875rem;
    color: var(--ink-light);
    text-align: center;
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .result-actions {
    display: flex;
    gap: 1rem;
  }

  .text-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.75rem;
    color: var(--ink-light);
    cursor: pointer;
    text-decoration: none;
  }

  .text-btn:hover {
    color: var(--ink);
  }

  .error p {
    margin: 0 0 0.5rem 0;
    font-size: 0.8125rem;
  }

  .footer {
    margin-top: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-text {
    font-size: 0.6875rem;
    color: var(--ink-light);
    text-transform: lowercase;
  }

  .footer-text p {
    margin: 0;
  }

  .github-link {
    color: var(--ink-light);
    transition: color 0.15s;
  }

  .github-link:hover {
    color: var(--ink);
  }

  .github-icon {
    width: 20px;
    height: 20px;
  }
</style>
