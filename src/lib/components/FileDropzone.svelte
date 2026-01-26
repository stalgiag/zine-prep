<script lang="ts">
  interface Props {
    onFileSelect: (file: File) => void;
    disabled?: boolean;
  }

  let { onFileSelect, disabled = false }: Props = $props();

  let isDragging = $state(false);
  let fileInput: HTMLInputElement;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) {
      isDragging = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;

    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validatePdf(file)) {
        onFileSelect(file);
      }
    }
  }

  function handleClick() {
    if (!disabled) {
      fileInput?.click();
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && validatePdf(file)) {
      onFileSelect(file);
    }
    input.value = '';
  }

  function validatePdf(file: File): boolean {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a PDF file');
      return false;
    }
    return true;
  }
</script>

<button
  type="button"
  class="dropzone"
  class:dragging={isDragging}
  class:disabled={disabled}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onclick={handleClick}
  {disabled}
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".pdf,application/pdf"
    onchange={handleFileChange}
    class="hidden"
  />

  {#if isDragging}
    <span>drop here</span>
  {:else}
    <span>drop .pdf or [<span class="link">select file</span>]</span>
  {/if}
</button>

<style>
  .dropzone {
    width: 100%;
    padding: 2rem 1rem;
    border: 1px dashed var(--xerox-gray);
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--ink-light);
    text-align: center;
  }

  .dropzone:hover {
    color: var(--ink);
    border-color: var(--ink);
  }

  .dropzone:focus {
    outline: 1px dashed var(--ink);
    outline-offset: 2px;
  }

  .dropzone.dragging {
    background: white;
    border-style: solid;
    color: var(--ink);
  }

  .dropzone.disabled {
    opacity: 0.4;
    cursor: wait;
  }

  .link {
    text-decoration: underline;
  }

  .hidden {
    display: none;
  }
</style>
