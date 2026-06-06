export type Role = 'worker' | 'admin' | 'developer'; 
export type Category = 'lokomotiv' | 'korxona' | 'qurulish' | 'tamirlash'; 
 
export interface Uzel { 
  id: string; 
  name: string; 
  slug: string; 
  description: string; 
  icon: string; 
} 
 
export interface Zapravka { 
  id: string; 
  uzelId: string; 
  name: string; 
  slug: string; 
} 
 
export interface AccessCode { 
  code: string; 
  role: Role; 
  displayName: string; 
  nodeId: string | null; 
  stationId: string | null; 
  codeType: 'admin' | 'developer'; 
  isActive: boolean; 
  createdAt: number; 
} 
 
export interface Session { 
  sessionToken: string; 
  code: string; 
  role: Role; 
  nodeId: string | null; 
  stationId: string | null; 
  displayName: string; 
  expiresAt: number; 
} 

/** Firestore `staff` — tabel raqam butun bazada yagona; kirish uchun kiritilgan kod bilan mos kelishi mumkin */
export interface StaffVaultRecord {
  id: string;
  erju: string;
  zapravka: string;
  tabelNumber: string;
  fullName: string;
} 
 
export interface DeviceLock { 
  deviceId: string; 
  attempts: number; 
  lockedAt: number; 
  lockedCode: string; 
  isBlocked: boolean; 
} 
 
export type SecurityEvent = {
  id: string; 
  type: 'wrong_code' | 'device_locked' | 'successful_login'; 
  code: string; 
  deviceId: string; 
  timestamp: number; 
  meta?: Record<string, unknown>; 
}

export type HarakatTuri = 'yuk' | 'yolovchi' | 'manyovr' | 'xojalik' | 'ijara'; 
 
export type Rusumi = 'TEM2' | 'CHME-3' | '2TE10M' | '3TE10M' | '4TE10M' | 'TEP70' | 'UZTE16M2' | 'UZTE16M3' | 'UZTE16M4' | 'OʻZ12T' | 'ТГМ';
 
export interface LokomotivSubmission { 
  id: string; 
  staffCode: string; 
  staffName: string; 
  nodeId: string; 
  stationId: string; 
  category: 'lokomotiv'; 
  
  // 11 so'rovnoma 
  harakatTuri: HarakatTuri; 
  rusumi: Rusumi; 
  lokomotivNumber: string; 
  jadval?: string;              // yuk/manyovr/yo'lovchi uchun qo'shimcha select
  zagranitsa?: number;           // Y.PDF dagi zagranitsa ustuni uchun ixtiyoriy qiymat
  poyezdNumber?: string;        // ixtiyoriy (manyovrda yo'q)
  ruxsatIndeksi?: string;       // ruxsat indeksi
  poyezdVazni?: number;         // faqat YUK uchun
  qoldiq: number;               // kg 
  qanchaBerildi: number;        // kg 
  dizMasla: number;             // kg (7.1 so'rovnoma) 
  stansiya?: string;            // manyovrda kerak 
  tashkilot?: string;           // xo'jalikda kerak 
  ijarachi?: string;            // ijarada kerak 
  mashinadaYetkazildi: boolean; 
  mashinaRaqami?: string;       // mashinada=true bo'lsa 
  
  // Meta 
  timestamp: number; 
  createdAt: number; 
  isOverLimit?: boolean; 
  isEdited?: boolean; 
  editedAt?: number; 
} 

export interface KorxonaSubmission { 
  id: string; 
  staffCode: string; 
  staffName: string; 
  nodeId: string; 
  stationId: string; 
  category: 'korxona'; 
  
  korxonaNomi: string; 
  poyezdNumber?: string;
  ruxsatIndeksi?: string;
  qancha: number;              // kg 
  nechaSutkalik: number;       // necha kun 
  buyruqNumber?: string;       // eski yozuvlar uchun ixtiyoriy
  kimTomonidan?: string;       // eski yozuvlar uchun ixtiyoriy
  buyruqVaqti?: number;        // eski yozuvlar uchun ixtiyoriy
  mashinadaYetkazildi: boolean; 
  mashinaRaqami?: string; 
  
  // Eski limit yozuvlari uchun ixtiyoriy metadata
  limit?: number;
  isOverLimit?: boolean;
  oshiqMiqdor?: number;
  
  timestamp: number; 
  createdAt: number; 
  isEdited?: boolean; 
  editedAt?: number; 
} 
 
export interface QurulishSubmission { 
  id: string; 
  staffCode: string; 
  staffName: string; 
  nodeId: string; 
  stationId: string; 
  category: 'qurulish'; 
  
  seriya: string;
  raqami: string;
  poyezdNumber: string;
  ruxsatIndeksi: string;
  poyezdVazni: number;
  qoldiq: number;
  qanchaBerildi: number;       // kg
  qanchaOlindi: number;        // kg, summary/backward compatibility

  // Eski qurulish yozuvlari uchun ixtiyoriy maydonlar
  korxonaNomi?: string;
  texnikaSoni?: number;
  obyekt?: string;
  masulShaxs?: string;
  lavozim?: string;
  dopLimit?: number;
  buyruqNumber?: string; 
  kimTomonidan?: string; 
  buyruqVaqti?: number; 
  mashinadaYetkazildi: boolean; 
  mashinaRaqami?: string; 
  
  limit?: number; 
  isOverLimit?: boolean; 
  oshiqMiqdor?: number; 
  
  timestamp: number; 
  createdAt: number; 
  isEdited?: boolean; 
  editedAt?: number; 
} 
 
export interface TamirlashSubmission { 
  id: string; 
  staffCode: string; 
  staffName: string; 
  nodeId: string; 
  stationId: string; 
  category: 'tamirlash'; 
  
  seriya: string;              // TEM2, ChME-3, va h.k. 
  raqami: string; 
  tamirlashTuri: 'katta' | 'kichik' | 'profilaktika'; 
  qanchaBerildi: number;       // kg 
  dizMasla?: number;           // kg (ixtiyoriy) 
  masulShaxs: string; 
  mashinadaYetkazildi: boolean; 
  mashinaRaqami?: string; 
  
  timestamp: number; 
  createdAt: number; 
  isEdited?: boolean; 
  editedAt?: number; 
} 

export type Submission = LokomotivSubmission | KorxonaSubmission | QurulishSubmission | TamirlashSubmission;

export type ReportType = 
  | 'spr_day'           // Kunlik operativ 
  | 'svod_spr'          // Kunlik umumiy 
  | 'monthly'           // Oylik 
  | 'yearly'            // Yillik 
  | 'period'            // Oraliq 
  | 'over_limit'        // Limitdan oshganlar 
  | 'qurulish';         // Qurulish 
 
export type GroupType = 'republic' | 'node' | 'station'; 
export type CalendarMode = 'single' | 'range' | 'month' | 'year'; 
 
export interface ReportPeriod { 
  mode: CalendarMode; 
  startDate: number;       // timestamp 
  endDate: number;         // timestamp 
  label: string;           // "16/04/2026" yoki "Aprel 2026" 
} 
 
export interface ReportFilter { 
  reportType: ReportType;
  groupType: GroupType; 
  nodeId?: string; 
  stationId?: string; 
  period: ReportPeriod; 
} 
 
export interface ZapravkaSummary { 
  zapravkaId: string; 
  zapravkaName: string; 
  nodeId: string; 
  
  // Asosiy ustunlar (kg) 
  sutkaTotal: number;              // 1 sutkada tarqatilgan jami 
  teplovozTotal: number;           // Jami teplovozlarga (Lokomotiv + Ta'mirlash) 
  yuk: number;                     // Yuk poyezd uchun 
  yolovchi: number;                // Yo'lovchi 
  manyovr: number;                 // Manyovr 
  xojalik: number;                 // Xo'jalik 
  ijara: number;                   // Ijara 
  tamirlash: number;               // Teplovozlar ta'mirlash 
  refSeksiya: number;              // Ref. sektsiya 
  korxonaTotal: number;            // Korxonalarga 
  qurulishTotal: number;           // Qurulish ishlariga 
  dizMasla: number;                // Diz masla jami (YANGI) 
  
  // Teplovoz soni 
  teplovozCount: { 
    yuk: number; 
    yolovchi: number; 
    manyovr: number; 
    xojalik: number; 
    ijara: number; 
    total: number; 
  }; 
} 
 
export interface NodeSummary { 
  nodeId: string; 
  nodeName: string; 
  zapravkalar: ZapravkaSummary[]; 
  totals: Omit<ZapravkaSummary, 'zapravkaId' | 'zapravkaName' | 'nodeId'>; 
} 
 
export interface ReportData { 
  filter: ReportFilter; 
  generatedAt: number; 
  generatedBy: string; 
  
  nodes: NodeSummary[]; 
  republicTotals: Omit<ZapravkaSummary, 'zapravkaId' | 'zapravkaName' | 'nodeId'>; 
  
  // Admin qo'lda to'ldirgan 
  manualFields: Record<string, string | number>; 
} 

export interface Limit { 
  id: string; 
  type: 'korxona' | 'qurulish' | 'lokomotiv' | 'stansiya'; 
  
  // Korxona/Qurulish uchun 
  korxonaNomi?: string; 
  
  // Lokomotiv uchun 
  seriya?: string; 
  lokomotivNumber?: string; 
  
  // Stansiya uchun (lokomotiv + stansiya) 
  stansiyaName?: string; 
  
  stationId: string;        // qaysi zapravka uchun 
  limit: number;             // kg/sutka 
  
  isActive: boolean; 
  createdBy: string; 
  createdAt: number; 
  updatedAt: number; 
} 
 
export interface FormQuestion { 
  id: string; 
  category: 'lokomotiv' | 'korxona' | 'qurulish' | 'tamirlash'; 
  stationId: string;          // qaysi zapravka uchun (bo'sh = barcha) 
  
  order: number; 
  label: string; 
  fieldKey: string;            // forma ichidagi nom 
  fieldType: 'text' | 'number' | 'dropdown' | 'datetime' | 'boolean'; 
  
  options?: string[];          // dropdown uchun 
  isRequired: boolean; 
  isVisible: boolean; 
  
  // Conditional logic (boshqa savolga bog'liq) 
  showWhen?: { 
    questionId: string; 
    value: string; 
  }; 
  
  // PDF da qaysi ustunga tushadi 
  pdfColumn?: string;          // "Izoh" yoki yangi ustun nomi 
  
  createdAt: number; 
  updatedAt: number; 
} 
 
export interface AuditLog { 
  id: string; 
  userId: string; 
  userName: string; 
  userRole: string; 
  action: 'create' | 'update' | 'delete'; 
  entityType: string;          // 'submission', 'limit', 'code', 'setting' va h.k. 
  entityId: string; 
  changes: Record<string, { old: any; new: any }>; 
  timestamp: number; 
} 
