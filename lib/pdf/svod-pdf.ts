import jsPDF from 'jspdf'; 
import autoTable from 'jspdf-autotable'; 
import type { ReportData } from '@/lib/types'; 
import { formatPdfNumber } from '@/lib/utils/pdf-number';
 
export function generateSvodPDF(data: ReportData, language: 'uz' | 'ru' = 'uz'): jsPDF { 
  const doc = new jsPDF('landscape', 'mm', 'a4'); 
  
  // Header 
  doc.setFontSize(14); 
  doc.text(`${data.filter.period.label} sutkasi`, doc.internal.pageSize.width / 2, 15, { align: 'center' }); 
  doc.text("mobaynida dizel' yoqilg'isi tarqatilishi xaqida", doc.internal.pageSize.width / 2, 22, { align: 'center' }); 
  doc.setFontSize(16); 
  doc.text("MA'LUMOTNOMA", doc.internal.pageSize.width / 2, 30, { align: 'center' }); 
  
  // Jadval headers 
  const headers = [ 
    [ 
      { content: '№', rowSpan: 2 }, 
      { content: "Yonilg'i omborlari", rowSpan: 2 }, 
      { content: '1 sutkada\ntarqatilgan', rowSpan: 2 }, 
      { content: 'Jami teplo-\nvozlarga', rowSpan: 2 }, 
      { content: 'Shu jumladan', colSpan: 8 }, 
      { content: 'Korxona-\nlarga', rowSpan: 2 }, 
      { content: 'Qurulish\nishlariga', rowSpan: 2 }, 
      { content: 'Diz\nmasla', rowSpan: 2 }, 
    ], 
    [ 
      'Yuk', "Yo'lovchi", 'Manyovr', "Xo'jalik", 'Ijara', 
      "Ta'mirlash", 'Ref.\nseksiya' 
    ] 
  ]; 
  
  // Jadval body - har uzel + zapravkalar 
  const body: any[] = []; 
  let counter = 1; 
  
  for (const node of data.nodes) { 
    // Zapravkalar 
    for (const zap of node.zapravkalar) { 
      body.push([ 
        counter++, 
        zap.zapravkaName, 
        formatPdfNumber(zap.sutkaTotal), 
        formatPdfNumber(zap.teplovozTotal), 
        formatPdfNumber(zap.yuk), 
        formatPdfNumber(zap.yolovchi), 
        formatPdfNumber(zap.manyovr), 
        formatPdfNumber(zap.xojalik), 
        formatPdfNumber(zap.ijara), 
        formatPdfNumber(zap.tamirlash), 
        formatPdfNumber(zap.refSeksiya), 
        formatPdfNumber(zap.korxonaTotal), 
        formatPdfNumber(zap.qurulishTotal), 
        formatPdfNumber(zap.dizMasla), 
      ]); 
    } 
    
    // Uzel jami 
    const t = node.totals; 
    body.push([ 
      { content: node.nodeName, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
      formatPdfNumber(t.sutkaTotal), 
      formatPdfNumber(t.teplovozTotal), 
      formatPdfNumber(t.yuk), 
      formatPdfNumber(t.yolovchi), 
      formatPdfNumber(t.manyovr), 
      formatPdfNumber(t.xojalik), 
      formatPdfNumber(t.ijara), 
      formatPdfNumber(t.tamirlash), 
      formatPdfNumber(t.refSeksiya), 
      formatPdfNumber(t.korxonaTotal), 
      formatPdfNumber(t.qurulishTotal), 
      formatPdfNumber(t.dizMasla), 
    ].map(v => typeof v === 'object' ? v : { content: v, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } })); 
  } 
  
  // Respublika jami 
  const r = data.republicTotals; 
  body.push([ 
    { content: '"O\'TY" AJ', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [200, 230, 255] } }, 
    ...[r.sutkaTotal, r.teplovozTotal, r.yuk, r.yolovchi, r.manyovr, r.xojalik, r.ijara, r.tamirlash, r.refSeksiya, r.korxonaTotal, r.qurulishTotal, r.dizMasla] 
      .map(v => ({ content: formatPdfNumber(v), styles: { fontStyle: 'bold', fillColor: [200, 230, 255] } })) 
  ]); 
  
  autoTable(doc, { 
    head: headers, 
    body, 
    startY: 35, 
    styles: { fontSize: 8, cellPadding: 2 }, 
    headStyles: { fillColor: [30, 58, 138], textColor: 255 }, 
    theme: 'grid', 
  }); 
  
  // Manual fields 
  let yPos = (doc as any).lastAutoTable.finalY + 5; 
  doc.setFontSize(10); 
  
  for (const [key, value] of Object.entries(data.manualFields)) { 
    doc.text(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`, 10, yPos); 
    yPos += 5; 
  } 
  
  // Pastki teplovoz statistikasi 
  yPos += 5; 
  const statHeaders = [['', ...data.nodes.map(n => n.nodeName), 'Jami']]; 
  const statBody = [ 
    ['пасс', ...data.nodes.map(n => n.totals.teplovozCount.yolovchi.toString()), data.republicTotals.teplovozCount.yolovchi.toString()], 
    ['груз', ...data.nodes.map(n => n.totals.teplovozCount.yuk.toString()), data.republicTotals.teplovozCount.yuk.toString()], 
    ['ман', ...data.nodes.map(n => n.totals.teplovozCount.manyovr.toString()), data.republicTotals.teplovozCount.manyovr.toString()], 
    ['х/раб', ...data.nodes.map(n => n.totals.teplovozCount.xojalik.toString()), data.republicTotals.teplovozCount.xojalik.toString()], 
    ['арен', ...data.nodes.map(n => n.totals.teplovozCount.ijara.toString()), data.republicTotals.teplovozCount.ijara.toString()], 
  ]; 
  
  autoTable(doc, { 
    head: statHeaders, 
    body: statBody, 
    startY: yPos, 
    styles: { fontSize: 9 }, 
    headStyles: { fillColor: [30, 58, 138], textColor: 255 }, 
  }); 
  
  return doc; 
} 
