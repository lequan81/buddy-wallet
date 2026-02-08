import type { VietQRBank } from './bank';

/**
 * MMajor Vietnamese banks fallback data
 * Used when VietQR API is unavailable
 * To add more banks: edit this file without changing service code
 */
export const MAJOR_BANKS_FALLBACK: VietQRBank[] = [
  {
    id: 17,
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    code: 'VCB',
    bin: '970436',
    shortName: 'Vietcombank',
    logo: 'https://img.vietqr.io/image/VCB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 42,
    name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
    code: 'TCB',
    bin: '970407',
    shortName: 'Techcombank',
    logo: 'https://img.vietqr.io/image/TCB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 2,
    name: 'Ngân hàng TMCP Công Thương Việt Nam',
    code: 'CTG',
    bin: '970415',
    shortName: 'VietinBank',
    logo: 'https://img.vietqr.io/image/CTG-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 4,
    name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    code: 'BIDV',
    bin: '970418',
    shortName: 'BIDV',
    logo: 'https://img.vietqr.io/image/BIDV-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 10,
    name: 'Ngân hàng TMCP Á Châu',
    code: 'ACB',
    bin: '970416',
    shortName: 'ACB',
    logo: 'https://img.vietqr.io/image/ACB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 21,
    name: 'Ngân hàng TMCP Quân đội',
    code: 'MB',
    bin: '970422',
    shortName: 'MBBank',
    logo: 'https://img.vietqr.io/image/MB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 47,
    name: 'Ngân hàng TMCP Tiên Phong',
    code: 'TPB',
    bin: '970423',
    shortName: 'TPBank',
    logo: 'https://img.vietqr.io/image/TPB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  }
];
