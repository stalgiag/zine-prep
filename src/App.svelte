<script lang="ts">
  import FileDropzone from './lib/components/FileDropzone.svelte';
  import ProgressIndicator from './lib/components/ProgressIndicator.svelte';
  import DownloadButton from './lib/components/DownloadButton.svelte';
  import { createImposedPdf } from './lib/utils/pdf-processor';
  import type { ProcessingProgress } from './lib/types';

  let sourceFile = $state<File | null>(null);
  let outputPdf = $state<Uint8Array | null>(null);
  let error = $state<string | null>(null);
  let progress = $state<ProcessingProgress>({
    stage: 'idle',
    percent: 0,
    message: '',
  });

  let isProcessing = $derived(
    progress.stage !== 'idle' &&
    progress.stage !== 'complete' &&
    progress.stage !== 'error'
  );

  let outputFilename = $derived(
    sourceFile
      ? sourceFile.name.replace(/\.pdf$/i, '-imposed.pdf')
      : 'imposed.pdf'
  );

  async function handleFileSelect(file: File) {
    sourceFile = file;
    outputPdf = null;
    error = null;

    try {
      const arrayBuffer = await file.arrayBuffer();

      outputPdf = await createImposedPdf(arrayBuffer, (p) => {
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

  function handleReset() {
    sourceFile = null;
    outputPdf = null;
    error = null;
    progress = {
      stage: 'idle',
      percent: 0,
      message: '',
    };
  }
</script>

<main class="container">
  <header class="header">
    <h1>ZINE IMPOSER</h1>
    <p class="tagline">pdf → booklet layout</p>
  </header>

  <div class="box">
    {#if !sourceFile}
      <FileDropzone onFileSelect={handleFileSelect} disabled={isProcessing} />
    {:else}
      <div class="file-row">
        <span class="filename">{sourceFile.name}</span>
        <span class="filesize">[{(sourceFile.size / 1024).toFixed(0)}kb]</span>
      </div>

      <div class="divider"></div>

      <ProgressIndicator {progress} />

      {#if outputPdf && progress.stage === 'complete'}
        <div class="divider"></div>
        <div class="result">
          <DownloadButton pdfData={outputPdf} filename={outputFilename} />
          <button type="button" class="text-btn" onclick={handleReset}>
            [reset]
          </button>
        </div>
      {/if}

      {#if error}
        <div class="divider"></div>
        <div class="error">
          <p>ERROR: {error}</p>
          <button type="button" class="text-btn" onclick={handleReset}>
            [try again]
          </button>
        </div>
      {/if}
    {/if}
  </div>

  <footer class="footer">
    <p>print duplex / flip short edge / fold / staple</p>
  </footer>
</main>

<style>
  .container {
    max-width: 420px;
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

  .result {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
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
