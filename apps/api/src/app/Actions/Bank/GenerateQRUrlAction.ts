import { injectable, inject } from "tsyringe";

@injectable()
export class GenerateQRUrlAction {
    execute(params: {
            bankBin: string;
            accountNumber: string;
            amount?: number;
            description?: string;
            accountName?: string;
            template?: 'compact' | 'compact2' | 'qr_only' | 'print';
          }): string {
        const {
          bankBin,
          accountNumber,
          amount,
          description,
          accountName,
          template = 'compact2'
        } = params;

        const baseUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png`;
        const searchParams = new URLSearchParams();

        if (amount) searchParams.append('amount', amount.toString());
        if (description) searchParams.append('addInfo', description);
        if (accountName) searchParams.append('accountName', accountName);

        const queryString = searchParams.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }
}
