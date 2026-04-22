import { injectable, inject } from 'tsyringe';
import type { Result } from '@repo/types';
import { PushService } from '@/app/Services/PushService';
import type { SubscribeInput } from '@/types/push';

@injectable()
export class SubscribeAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  async execute(
    userId: string,
    input: SubscribeInput
  ): Promise<Result<{ subscriptionId: string }>> {
    return this.pushService.subscribe(userId, input);
  }
}
