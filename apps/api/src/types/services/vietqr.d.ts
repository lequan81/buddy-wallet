import { VietQRBank } from '@repo/types';

export interface VietQRResponse {
  code: string;
  desc: string;
  data: VietQRBank[];
}
