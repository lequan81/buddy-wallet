import { injectable, inject } from "tsyringe";
import type { DebtStatus, PaginatedResult, DebtDetails, PaginationOptions } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class GetDebtsAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(userId: string, options: PaginationOptions & { viewAll?: boolean } = {}): Promise<PaginatedResult<DebtDetails>> {
        const status = options.status as DebtStatus | 'all';
        const result = await this.debtRepo.findMany({
          ...options,
          status,
          involvedUserId: options.viewAll ? undefined : userId
        });

        return {
          items: result.items.map(toDebtDetails),
          pagination: result.pagination
        };
    }
}
