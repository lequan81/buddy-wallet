<!--
  WelcomeEmail.svelte - Welcome Email Template
  
  Uses EmailLayout for consistent structure and proper preview text.
-->
<script lang="ts">
  import EmailLayout from '../components/EmailLayout.svelte';

  interface Props {
    name: string;
    loginUrl?: string;
  }

  let { name, loginUrl = 'https://buddywallet.app/login' }: Props = $props();

  // Use $derived to fix "state_referenced_locally" warning
  const previewText = $derived(`Welcome to BuddyWallet, ${name}! Your account is ready.`);
</script>

<EmailLayout title="Welcome to BuddyWallet!" preview={previewText}>
  <!-- Header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td>
          <h1
            style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #0f172a; letter-spacing: -0.025em;"
          >
            Welcome to BuddyWallet!
          </h1>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">Your account is ready</p>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Greeting -->
  <p style="margin: 0 0 16px 0; font-size: 16px; color: #0f172a; line-height: 1.5;">
    Hi <strong>{name}</strong>,
  </p>

  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
    Thanks for joining BuddyWallet! We're excited to have you on board.
  </p>

  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
    With BuddyWallet, you can:
  </p>

  <ul
    style="margin: 0 0 24px 0; padding-left: 20px; color: #64748b; font-size: 14px; line-height: 1.8;"
  >
    <li>Track shared expenses with friends</li>
    <li>Split bills easily</li>
    <li>Settle debts with QR payments</li>
  </ul>

  <!-- CTA Button -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <a
            href={loginUrl}
            style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;"
          >
            Get Started
          </a>
        </td>
      </tr>
    </tbody>
  </table>
</EmailLayout>
