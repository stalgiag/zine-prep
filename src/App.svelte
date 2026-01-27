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
    {#if appState === 'complete' && printInstructions}
      <p>{printInstructions}</p>
    {:else if appState === 'selecting'}
      <p>select a tool to get started</p>
    {:else if selectedTool}
      <p>{selectedTool.description}</p>
    {/if}
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

  .tagline {
    font-size: 0.75rem;
    color: var(--ink-light);
    margin: 0.25rem 0 0 0;
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
    font-size: 0.6875rem;
    color: var(--ink-light);
    text-transform: lowercase;
  }

  .footer p {
    margin: 0;
  }
</style>
