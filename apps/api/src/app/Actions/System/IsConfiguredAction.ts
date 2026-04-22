import { injectable, inject } from 'tsyringe';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class IsConfiguredAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  execute(): boolean {
    return this.pushService.isConfigured();
  }
}
