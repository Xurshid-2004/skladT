import * as XLSX from 'xlsx'; 
import { saveAs } from 'file-saver'; 
import type { ReportData } from '@/lib/types'; 
 
export function exportToExcel(data: ReportData, filename: string) { 
  const workbook = XLSX.utils.book_new(); 
  
  // Headers 
  const headers = [ 
    '№', "Yonilg'i omborlari", '1 sutkada tarqatilgan', 'Jami teplovozlarga', 
    'Yuk', "Yo'lovchi", 'Manyovr', "Xo'jalik", 'Ijara', 
    "Ta'mirlash", 'Ref. seksiya', 'Korxonalarga', 'Qurulish ishlariga', 'Diz masla' 
  ]; 
  
  const rows: any[][] = [headers]; 
  let counter = 1; 
  
  for (const node of data.nodes) { 
    for (const zap of node.zapravkalar) { 
      rows.push([ 
        counter++, zap.zapravkaName, zap.sutkaTotal, zap.teplovozTotal, 
        zap.yuk, zap.yolovchi, zap.manyovr, zap.xojalik, zap.ijara, 
        zap.tamirlash, zap.refSeksiya, zap.korxonaTotal, zap.qurulishTotal, zap.dizMasla 
      ]); 
    } 
    const t = node.totals; 
    rows.push(['', node.nodeName, t.sutkaTotal, t.teplovozTotal, 
      t.yuk, t.yolovchi, t.manyovr, t.xojalik, t.ijara, 
      t.tamirlash, t.refSeksiya, t.korxonaTotal, t.qurulishTotal, t.dizMasla 
    ]); 
  } 
  
  const r = data.republicTotals; 
  rows.push(['', "O'TY AJ", r.sutkaTotal, r.teplovozTotal, 
    r.yuk, r.yolovchi, r.manyovr, r.xojalik, r.ijara, 
    r.tamirlash, r.refSeksiya, r.korxonaTotal, r.qurulishTotal, r.dizMasla 
  ]); 
  
  const worksheet = XLSX.utils.aoa_to_sheet(rows); 
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot'); 
  
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }); 
  const blob = new Blob([buffer], { type: 'application/octet-stream' }); 
  saveAs(blob, filename); 
} 
