import { injectable, inject } from "tsyringe";
import { VietQRService, type VietQRBank } from "@/app/Services/VietQRService";

@injectable()
export class GetBanksAction {
    constructor(
      @inject(VietQRService) private readonly vietQRService: VietQRService
    ) {}

    async execute(): Promise<VietQRBank[]> {
        return this.vietQRService.getBanks();
    }
}
