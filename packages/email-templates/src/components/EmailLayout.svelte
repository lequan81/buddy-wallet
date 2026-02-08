<!--
  EmailLayout - Base email layout wrapper
  
  Usage: <EmailLayout><slot /></EmailLayout>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import EmailCard from './EmailCard.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const year = new Date().getFullYear();
</script>

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body
    style="margin: 0; padding: 0; background-color: hsl(0 0% 98%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"
  >
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tbody>
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <EmailCard>
              {#snippet children()}
                {@render children()}
                <hr style="border: none; border-top: 1px solid hsl(0 0% 90%); margin: 24px 0;" />
                <p style="margin: 0; font-size: 12px; color: hsl(215 16% 57%); text-align: center;">
                  © {year} BuddyWallet. All rights reserved.
                </p>
              {/snippet}
            </EmailCard>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
