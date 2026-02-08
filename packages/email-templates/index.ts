import Handlebars from 'handlebars';

// Basic templates to embed in the package
// In a real build, we might read these from files, but for simplicity here we inline them or read them in node.
// Since we're in a monorepo building with Bun, we can just export functions that use string templates or import them.

// For now, let's use string constants to avoid file reading issues at runtime if the build process is simple.
// Or we can use Bun's file loader.

// Let's define the templates as strings here for simplicity and zero-config deployment.
const header = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`;

const footer = `  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">© {{year}} BuddyWallet</p>
  </div>
</body>
</html>`;

const otpTemplate = `{{> header}}
    <h2 style="color: #2563eb; margin-top: 0;">BuddyWallet Verification</h2>
    <p style="color: #374151;">Hi{{#if name}} <strong>{{name}}</strong>{{/if}},</p>
    <p style="color: #374151;">Your verification code is:</p>
    <div style="background: #eff6ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">{{otp}}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color: #9ca3af; font-size: 13px;">If you didn't request this, please ignore this email.</p>
{{> footer}}`;

// Register partials
Handlebars.registerPartial('header', header);
Handlebars.registerPartial('footer', footer);

// Compile templates
const compiledOtp = Handlebars.compile(otpTemplate);

export interface OtpEmailData {
  otp: string;
  name?: string;
  year?: number;
}

export const renderOtp = (data: OtpEmailData): string => {
  return compiledOtp({
    year: new Date().getFullYear(),
    ...data
  });
};
