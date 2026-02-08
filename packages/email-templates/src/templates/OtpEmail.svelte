<!--
  OtpEmail.svelte - OTP Verification Email Template
  
  Self-contained email template with inline styles.
-->
<script lang="ts">
  interface Props {
    otp: string;
    name?: string;
  }

  let { otp, name }: Props = $props();
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
                      BuddyWallet
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: hsl(215 16% 47%);">
                      Verification Code
                    </p>

                    <!-- Greeting -->
                    <p
                      style="margin: 0 0 16px 0; font-size: 16px; color: hsl(222 47% 11%); line-height: 1.5;"
                    >
                      {#if name}
                        Hi <strong>{name}</strong>,
                      {:else}
                        Hi there,
                      {/if}
                    </p>

                    <p
                      style="margin: 0 0 16px 0; font-size: 14px; color: hsl(215 16% 47%); line-height: 1.5;"
                    >
                      Use the following code to verify your account:
                    </p>

                    <!-- OTP Code Box -->
                    <div
                      style="background-color: hsl(222 47% 11%); border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px 0;"
                    >
                      <span
                        style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: hsl(0 0% 100%); font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;"
                      >
                        {otp}
                      </span>
                    </div>

                    <p
                      style="margin: 0 0 8px 0; font-size: 14px; color: hsl(215 16% 47%); line-height: 1.5;"
                    >
                      This code expires in <strong style="color: hsl(222 47% 11%);"
                        >10 minutes</strong
                      >.
                    </p>

                    <p
                      style="margin: 0 0 24px 0; font-size: 12px; color: hsl(215 16% 57%); line-height: 1.5;"
                    >
                      If you didn't request this code, you can safely ignore this email.
                    </p>

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
