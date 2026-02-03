/**
 * Test Email Script
 *
 * Run: bun run scripts/test-email.ts
 */
import { emailService } from '../src/services/email.service';

const testEmail = Bun.env.TEST_EMAIL || 'buddywallet81@gmail.com';

console.log('📧 Sending test OTP email to:', testEmail);
console.log('');

const result = await emailService.sendOtp(testEmail, '130409', 'Le Quan Development');

if (result.success) {
  console.log('✅ Email sent successfully!');
  console.log('   Message ID:', result.messageId);
} else {
  console.log('❌ Email failed to send');
  console.log('   Error:', result.error);
}

await emailService.close();
console.log('');
console.log('Done.');
