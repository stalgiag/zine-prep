<script lang="ts">
  interface Props {
    pdfData: Uint8Array;
    filename: string;
  }

  let { pdfData, filename }: Props = $props();

  function handleDownload() {
    const blob = new Blob([pdfData as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }
</script>

<button type="button" class="btn" onclick={handleDownload}>
  &gt;&gt; download {filename}
</button>

<style>
  .btn {
    padding: 0.375rem 0.75rem;
    background: var(--ink);
    color: white;
    border: none;
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    text-transform: lowercase;
  }

  .btn:hover {
    background: var(--ink-faded);
  }

  .btn:focus {
    outline: 1px dashed var(--ink);
    outline-offset: 2px;
  }
</style>
