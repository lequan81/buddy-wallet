import { injectable, inject } from 'tsyringe';
import { JobsService } from '@/app/Services/JobsService';

@injectable()
export class GetQueueStatusAction {
  constructor(@inject(JobsService) private readonly jobsService: JobsService) {}

  async execute(): Promise<{ pending: number }> {
    return this.jobsService.getQueueStatus();
  }
}
