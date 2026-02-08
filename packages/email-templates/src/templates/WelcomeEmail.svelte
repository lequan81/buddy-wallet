<!--
  WelcomeEmail.svelte - Welcome Email Template
  
  Self-contained email template with inline styles.
-->
<script lang="ts">
  interface Props {
    name: string;
    loginUrl?: string;
  }

  let { name, loginUrl = 'https://buddywallet.app/login' }: Props = $props();
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
            <!-- Card -->
            <table
              role="presentation"
              style="max-width: 480px; width: 100%; background-color: hsl(0 0% 100%); border-radius: 12px; border: 1px solid hsl(0 0% 90%); box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
            >
              <tbody>
                <tr>
                  <td style="padding: 32px;">
                    <!-- Header -->
                    <h1
                      style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: hsl(222 47% 11%); letter-spacing: -0.025em;"
                    >
                      Welcome to BuddyWallet!
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: hsl(215 16% 47%);">
                      Your account is ready
                    </p>

                    <!-- Greeting -->
                    <p
                      style="margin: 0 0 16px 0; font-size: 16px; color: hsl(222 47% 11%); line-height: 1.5;"
                    >
                      Hi <strong>{name}</strong>,
                    </p>

                    <p
                      style="margin: 0 0 16px 0; font-size: 14px; color: hsl(215 16% 47%); line-height: 1.5;"
                    >
                      Thanks for joining BuddyWallet! We're excited to have you on board.
                    </p>

                    <p
                      style="margin: 0 0 16px 0; font-size: 14px; color: hsl(215 16% 47%); line-height: 1.5;"
                    >
                      With BuddyWallet, you can:
                    </p>

                    <ul
                      style="margin: 0 0 24px 0; padding-left: 20px; color: hsl(215 16% 47%); font-size: 14px; line-height: 1.8;"
                    >
                      <li>Track shared expenses with friends</li>
                      <li>Split bills easily</li>
                      <li>Settle debts with QR payments</li>
                    </ul>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin-bottom: 24px;">
                      <a
                        href={loginUrl}
                        style="display: inline-block; padding: 12px 24px; background-color: hsl(222 47% 11%); color: hsl(0 0% 100%); border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;"
                      >
                        Get Started
                      </a>
                    </div>

                    <!-- Footer -->
                    <hr
                      style="border: none; border-top: 1px solid hsl(0 0% 90%); margin: 24px 0;"
                    />
                    <p
                      style="margin: 0; font-size: 12px; color: hsl(215 16% 57%); text-align: center;"
                    >
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
  </body>
</html>
