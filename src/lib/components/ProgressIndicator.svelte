<script lang="ts">
  import type { ProcessingProgress } from '../types';

  interface Props {
    progress: ProcessingProgress;
  }

  let { progress }: Props = $props();
</script>

<div class="progress">
  <div class="bar-container">
    <div
      class="bar-fill"
      class:error={progress.stage === 'error'}
      style="width: {progress.percent}%"
    ></div>
  </div>
  <span class="percent">{Math.round(progress.percent)}%</span>
</div>

{#if progress.message}
  <p class="status">{progress.message}</p>
{/if}

<style>
  .progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .bar-container {
    flex: 1;
    height: 6px;
    background: repeating-linear-gradient(
      90deg,
      var(--xerox-gray) 0px,
      var(--xerox-gray) 2px,
      transparent 2px,
      transparent 4px
    );
  }

  .bar-fill {
    height: 100%;
    background: var(--ink);
    transition: width 0.15s linear;
  }

  .bar-fill.error {
    background: #333;
  }

  .percent {
    font-size: 0.75rem;
    color: var(--ink-light);
    min-width: 3ch;
    text-align: right;
  }

  .status {
    margin: 0.5rem 0 0 0;
    font-size: 0.6875rem;
    color: var(--ink-light);
  }
</style>
