<!--
  EmailCodeBox - Email-safe OTP/code display component
  
  Usage: <EmailCodeBox code="123456" />
-->
<script lang="ts">
  interface Props {
    code: string;
  }

  let { code }: Props = $props();
</script>

<div
  style="background-color: hsl(222 47% 11%); border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px 0;"
>
  <span
    style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: hsl(0 0% 100%); font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;"
  >
    {code}
  </span>
</div>
