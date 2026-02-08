<!--
  EmailCard - Email-safe card component (shadcn-inspired)
  
  Usage: <EmailCard>content</EmailCard>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<table
  role="presentation"
  style="max-width: 480px; width: 100%; background-color: hsl(0 0% 100%); border-radius: 12px; border: 1px solid hsl(0 0% 90%); box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
>
  <tbody>
    <tr>
      <td style="padding: 32px;">
        {@render children()}
      </td>
    </tr>
  </tbody>
</table>
