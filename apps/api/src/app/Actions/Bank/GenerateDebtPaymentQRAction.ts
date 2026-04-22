import { injectable, inject } from "tsyringe";
import { VietQRService } from "@/app/Services/VietQRService";

@injectable()
export class GenerateDebtPaymentQRAction {
    constructor(
      @inject(VietQRService) private readonly vietQRService: VietQRService
    ) {}

    execute(params: {
      bankBin: string;
      accountNumber: string;
      accountName: string;
      amount: number;
      debtId: string;
      debtorName?: string;
    }): string {
        return this.vietQRService.generateDebtPaymentQR(params);
    }
}
