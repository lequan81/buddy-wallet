<!--
  EmailButton - Email-safe button component (shadcn-inspired)
  
  Usage: <EmailButton href="https://...">Click me</EmailButton>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href: string;
    variant?: 'default' | 'secondary';
    children: Snippet;
  }

  let { href, variant = 'default', children }: Props = $props();

  const styles = {
    default: 'background-color: hsl(222 47% 11%); color: hsl(0 0% 100%);',
    secondary: 'background-color: hsl(0 0% 96%); color: hsl(222 47% 11%);'
  };
</script>

<a
  {href}
  style="display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; {styles[
    variant
  ]}"
>
  {@render children()}
</a>
