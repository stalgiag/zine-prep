<script lang="ts">
  import type { Tool } from '../types';
  import ToolCard from './ToolCard.svelte';
  import { tools } from '../utils/formats';

  interface Props {
    onSelect: (tool: Tool) => void;
  }

  let { onSelect }: Props = $props();
</script>

<div class="tool-grid">
  {#each tools as tool}
    <ToolCard {tool} {onSelect} />
  {/each}
</div>

<style>
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  @media (max-width: 480px) {
    .tool-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
