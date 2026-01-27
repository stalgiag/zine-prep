<script lang="ts">
  import type { Tool } from '../types';

  interface Props {
    tool: Tool;
    onSelect: (tool: Tool) => void;
  }

  let { tool, onSelect }: Props = $props();
</script>

<button
  type="button"
  class="tool-card"
  onclick={() => onSelect(tool)}
>
  <span class="tool-name">{tool.name}</span>
  <span class="tool-divider">-----------</span>
  <span class="tool-tagline">{tool.tagline}</span>
</button>

<style>
  .tool-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 0.75rem;
    border: 2px solid var(--ink);
    background: white;
    cursor: pointer;
    font: inherit;
    text-align: center;
    min-height: 80px;
  }

  .tool-card:hover {
    background: var(--ink);
    color: white;
  }

  .tool-card:focus {
    outline: 1px dashed var(--ink);
    outline-offset: 2px;
  }

  .tool-name {
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .tool-divider {
    font-size: 0.625rem;
    color: var(--xerox-gray);
    margin: 0.25rem 0;
  }

  .tool-card:hover .tool-divider {
    color: rgba(255, 255, 255, 0.5);
  }

  .tool-tagline {
    font-size: 0.6875rem;
    color: var(--ink-light);
  }

  .tool-card:hover .tool-tagline {
    color: rgba(255, 255, 255, 0.8);
  }
</style>
