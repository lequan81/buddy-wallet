import { injectable, inject } from 'tsyringe';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class GetVapidPublicKeyAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  execute(): string {
    return this.pushService.getVapidPublicKey();
  }
}
