import { injectable, inject } from 'tsyringe';
import { EmailService, type EmailMessage, type SendResult } from '@/app/Services/EmailService';

@injectable()
export class SendAction {
  constructor(@inject(EmailService) private readonly emailService: EmailService) {}

  async execute(message: EmailMessage): Promise<SendResult> {
    return this.emailService.send(message);
  }
}
