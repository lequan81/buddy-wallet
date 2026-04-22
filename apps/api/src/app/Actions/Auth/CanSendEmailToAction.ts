import { injectable, inject } from "tsyringe";

@injectable()
export class CanSendEmailToAction {
    execute(user: { email?: string | null; emailVerified?: boolean }): boolean {
        return Boolean(user.email && user.emailVerified);
    }
}
