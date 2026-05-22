/**
 * Major Banks Fallback Data
 * 
 * Used when VietQR API is unavailable.
 */

export const MAJOR_BANKS_FALLBACK = [
  {
    id: 17,
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    code: 'VCB',
    bin: '970436',
    shortName: 'Vietcombank',
    logo: 'https://api.vietqr.io/img/VCB.png',
  },
  {
    id: 43,
    name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    code: 'BIDV',
    bin: '970418',
    shortName: 'BIDV',
    logo: 'https://api.vietqr.io/img/BIDV.png',
  },
  {
    id: 45,
    name: 'Ngân hàng TMCP Công thương Việt Nam',
    code: 'CTG',
    bin: '970415',
    shortName: 'VietinBank',
    logo: 'https://api.vietqr.io/img/CTG.png',
  },
  {
    id: 21,
    name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam',
    code: 'VBA',
    bin: '970405',
    shortName: 'Agribank',
    logo: 'https://api.vietqr.io/img/VBA.png',
  },
  {
    id: 38,
    name: 'Ngân hàng TMCP Quân đội',
    code: 'MB',
    bin: '970422',
    shortName: 'MBBank',
    logo: 'https://api.vietqr.io/img/MB.png',
  },
  {
    id: 22,
    name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    code: 'VPB',
    bin: '970432',
    shortName: 'VPBank',
    logo: 'https://api.vietqr.io/img/VPB.png',
  },
  {
    id: 42,
    name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
    code: 'TCB',
    bin: '970407',
    shortName: 'Techcombank',
    logo: 'https://api.vietqr.io/img/TCB.png',
  },
  {
    id: 19,
    name: 'Ngân hàng TMCP Á Châu',
    code: 'ACB',
    bin: '970416',
    shortName: 'ACB',
    logo: 'https://api.vietqr.io/img/ACB.png',
  },
  {
    id: 4,
    name: 'Ngân hàng TMCP Tiên Phong',
    code: 'TPB',
    bin: '970423',
    shortName: 'TPBank',
    logo: 'https://api.vietqr.io/img/TPB.png',
  }
];

export const BANK_CONFIG = {
  VIETQR_IMAGE_BASE: 'https://img.vietqr.io/image',
} as const;

