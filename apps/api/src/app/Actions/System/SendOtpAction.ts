import { injectable, inject } from 'tsyringe';
import { EmailService, type SendResult } from '@/app/Services/EmailService';

@injectable()
export class SendOtpAction {
  constructor(@inject(EmailService) private readonly emailService: EmailService) {}

  async execute(email: string, otp: string, name: string): Promise<SendResult> {
    return this.emailService.sendOtp(email, otp, name);
  }
}
