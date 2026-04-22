import { injectable, inject } from "tsyringe";
import { EmailService, type SendResult } from "@/app/Services/EmailService";

@injectable()
export class SendNotificationAction {
    constructor(
      @inject(EmailService) private readonly emailService: EmailService
    ) {}

    async execute(email: string, subject: string, content: string): Promise<SendResult> {
        return this.emailService.sendNotification(email, subject, content);
    }
}
