import { injectable, inject } from "tsyringe";
import { EmailService, type SendResult } from "@/app/Services/EmailService";

@injectable()
export class SendPasswordResetAction {
    constructor(
      @inject(EmailService) private readonly emailService: EmailService
    ) {}

    async execute(email: string, resetLink: string, name: string): Promise<SendResult> {
        return this.emailService.sendPasswordReset(email, resetLink, name);
    }
}
