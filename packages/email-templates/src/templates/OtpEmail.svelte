<!--
  OtpEmail.svelte - OTP Verification Email Template
  
  Uses EmailLayout for consistent structure and proper preview text.
-->
<script lang="ts">
  import EmailLayout from '../components/EmailLayout.svelte';

  interface Props {
    otp: string;
    name?: string;
  }

  let { otp, name }: Props = $props();

  // Use $derived to fix "state_referenced_locally" warning
  const previewText = $derived(`Your verification code is ${otp}. Valid for 10 minutes.`);
</script>

<EmailLayout title="Verify your BuddyWallet account" preview={previewText}>
  <!-- Header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td>
          <h1
            style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #0f172a; letter-spacing: -0.025em;"
          >
            BuddyWallet
          </h1>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">Verification Code</p>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Greeting -->
  <p style="margin: 0 0 16px 0; font-size: 16px; color: #0f172a; line-height: 1.5;">
    {#if name}
      Hi <strong>{name}</strong>,
    {:else}
      Hi there,
    {/if}
  </p>

  <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
    Use the following code to verify your account:
  </p>

  <!-- OTP Code Box -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td align="center" style="background-color: #0f172a; border-radius: 8px; padding: 24px;">
          <span
            style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff; font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;"
          >
            {otp}
          </span>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Expiry notice -->
  <p style="margin: 24px 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
    This code expires in <strong style="color: #0f172a;">10 minutes</strong>.
  </p>

  <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
    If you didn't request this code, you can safely ignore this email.
  </p>
</EmailLayout>
