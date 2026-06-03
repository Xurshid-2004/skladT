import { HarakatTuri, Rusumi } from "../types";

export const HARAKAT_TURI_LIST: { value: HarakatTuri; label: string; number: number }[] = [ 
  { value: 'yuk', label: 'Yuk', number: 1 }, 
  { value: 'manyovr', label: 'Manyovr', number: 2 }, 
  { value: 'yolovchi', label: "Yo'lovchi", number: 3 }, 
  { value: 'xojalik', label: "Xo'jalik", number: 4 }, 
  { value: 'ijara', label: 'Ijara', number: 5 }, 
]; 

const JADVAL_OPTIONS = [
  'ТЧ-1 Уз депос',
  'ТЧ-2 Коканд',
  'ТЧ-5 Тинчлик',
  'ТЧ-6 Бухоро',
  'ТЧ-7 Қўнғирот',
  'ТЧ-8 Карши',
  'ТЧ-8 Карши',
  'ТЧ-9 Термиз',
  'ТЧ-10 Урганч',
];

export const LOKOMOTIV_JADVAL_OPTIONS: Partial<Record<HarakatTuri, string[]>> = {
  yuk: JADVAL_OPTIONS,
  manyovr: JADVAL_OPTIONS,
  yolovchi: JADVAL_OPTIONS,
};
 
export const RUSUMI_LIST: { value: Rusumi; label: string; number: number; custom?: boolean }[] = [ 
  { value: 'TEM2', label: 'TEM-2', number: 1 }, 
  { value: 'CHME-3', label: 'ChME-3', number: 2 }, 
  { value: '2TE10M', label: '2TE10M', number: 3 }, 
  { value: '3TE10M', label: '3TE10M', number: 4 }, 
  { value: '4TE10M', label: '4TE10M', number: 5 }, 
  { value: 'TEP70', label: 'TEP70', number: 6 }, 
  { value: 'UZTE16M2', label: 'UZTE16M2', number: 7 }, 
  { value: 'UZTE16M3', label: 'UZTE16M3', number: 8 }, 
  { value: 'UZTE16M4', label: 'UZTE16M4', number: 9 },
  { value: 'OʻZ12T', label: "O'Z12T", number: 10 },
  { value: 'ТГМ', label: 'ТГМ', number: 11 },
];
 
// Dinamik filtr: qaysi rusumlar qaysi harakat turida ko'rinadi 
// TEP70 = yo'lovchi lokomotivi, faqat 'yolovchi' da chiqsin
export const RUSUMI_FILTER: Record<HarakatTuri, Rusumi[]> = {
  yuk: ['2TE10M', '3TE10M', '4TE10M', 'UZTE16M2', 'UZTE16M3', 'UZTE16M4', 'OʻZ12T', 'ТГМ'],
  yolovchi: ['2TE10M', '3TE10M', '4TE10M', 'TEP70', 'UZTE16M2', 'UZTE16M3', 'UZTE16M4', 'OʻZ12T', 'ТГМ'],
  manyovr: ['TEM2', 'CHME-3'],
  xojalik: ['TEM2', 'CHME-3', '2TE10M', '3TE10M', '4TE10M', 'UZTE16M2', 'UZTE16M3', 'UZTE16M4', 'OʻZ12T', 'ТГМ'],
  ijara: ['TEM2', 'CHME-3', '2TE10M', '3TE10M', '4TE10M', 'UZTE16M2', 'UZTE16M3', 'UZTE16M4', 'OʻZ12T', 'ТГМ'],
};

const TGM_RUSUMI = RUSUMI_LIST.find((r) => r.number === 11)?.value;
if (TGM_RUSUMI) {
  RUSUMI_FILTER.yuk = RUSUMI_FILTER.yuk.filter((r) => r !== TGM_RUSUMI);
  RUSUMI_FILTER.yolovchi = RUSUMI_FILTER.yolovchi.filter((r) => r !== TGM_RUSUMI);
}

// Qaysi maydonlar qaysi harakat turida ko'rinadi 
export const FIELDS_VISIBILITY: Record<HarakatTuri, string[]> = {
  yuk:      ['lokomotivNumber', 'poyezdNumber', 'ruxsatIndeksi', 'poyezdVazni', 'qoldiq', 'qanchaBerildi', 'dizMasla', 'zagranitsa'],
  yolovchi: ['lokomotivNumber', 'poyezdNumber', 'ruxsatIndeksi', 'qoldiq', 'qanchaBerildi', 'dizMasla', 'zagranitsa'],
  manyovr:  ['lokomotivNumber', 'stansiya', 'ruxsatIndeksi', 'qoldiq', 'qanchaBerildi', 'dizMasla', 'zagranitsa'],
  xojalik:  ['lokomotivNumber', 'poyezdNumber', 'ruxsatIndeksi', 'qoldiq', 'qanchaBerildi', 'dizMasla', 'tashkilot'],
  ijara:    ['lokomotivNumber', 'poyezdNumber', 'ruxsatIndeksi', 'qoldiq', 'qanchaBerildi', 'dizMasla', 'ijarachi'],
};
