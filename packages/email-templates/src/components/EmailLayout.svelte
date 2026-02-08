<!--
  EmailLayout.svelte - Base layout for all email templates
  
  Uses better-svelte-email components for:
  - Proper DOCTYPE (handled by Html component)
  - Preview text support (hidden text shown in inbox)
  - Title in head
  - Responsive container
-->
<script lang="ts">
  import type { EmailLayoutProps } from '../types/index';
  import { Html, Head, Body, Preview, Container } from 'better-svelte-email/components';

  let { title, preview, children }: EmailLayoutProps = $props();

  const year = new Date().getFullYear();
</script>

<Html lang="en">
  <Head>
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
    <title>{title}</title>
  </Head>
  <Preview {preview} />
  <Body
    style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;"
  >
    <!-- Card Container -->
    <Container style="max-width: 480px; padding: 40px 20px;">
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
      >
        <tbody>
          <tr>
            <td style="padding: 32px;">
              {@render children()}

              <!-- Footer -->
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;"
              >
                <tbody>
                  <tr>
                    <td align="center">
                      <p style="margin: 0; font-size: 12px; color: #6b7280;">
                        © {year} BuddyWallet. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Container>
  </Body>
</Html>
