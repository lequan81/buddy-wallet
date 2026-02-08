<!--
  EmailText - Email-safe text component with variants
  
  Usage: <EmailText variant="heading">Title</EmailText>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'heading' | 'subheading' | 'body' | 'muted' | 'small';
    children: Snippet;
  }

  let { variant = 'body', children }: Props = $props();

  const styles = {
    heading:
      'margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: hsl(222 47% 11%); letter-spacing: -0.025em;',
    subheading: 'margin: 0 0 24px 0; font-size: 14px; color: hsl(215 16% 47%);',
    body: 'margin: 0 0 16px 0; font-size: 16px; color: hsl(222 47% 11%); line-height: 1.5;',
    muted: 'margin: 0 0 8px 0; font-size: 14px; color: hsl(215 16% 47%); line-height: 1.5;',
    small: 'margin: 0; font-size: 12px; color: hsl(215 16% 57%); line-height: 1.5;'
  };
</script>

<p style={styles[variant]}>
  {@render children()}
</p>
