import { injectable, inject } from 'tsyringe';
import type { Result } from '@repo/types';
import { JobsService } from '@/app/Services/JobsService';

@injectable()
export class CancelJobAction {
  constructor(@inject(JobsService) private readonly jobsService: JobsService) {}

  async execute(jobId: string, userId: string): Promise<Result<void>> {
    return this.jobsService.cancelJob(jobId, userId);
  }
}
