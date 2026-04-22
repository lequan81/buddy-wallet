import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { PasswordResetService } from "@/app/Services/PasswordResetService";

@injectable()
export class RequestResetAction {
    constructor(
      @inject(PasswordResetService) private readonly resetService: PasswordResetService
    ) {}

    /**
     * Request password reset
     * Verifies email + phone match, generates temp password, sends email
     */
    async execute(email: string, phoneNumber: string): Promise<Result<void>> {
        return this.resetService.requestReset(email, phoneNumber);
    }
}
