import { injectable, inject } from 'tsyringe';
import { UserService } from '@/app/Services/UserService';

@injectable()
export class CanReceivePushAction {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  async execute(userId: string): Promise<boolean> {
    return this.userService.canReceivePush(userId);
  }
}
