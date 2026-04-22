import { injectable, inject } from 'tsyringe';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class GetUserSubscriptionsAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  async execute(userId: string) {
    return this.pushService.getUserSubscriptions(userId);
  }
}
