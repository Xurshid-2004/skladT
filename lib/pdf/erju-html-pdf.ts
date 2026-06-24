import { formatPdfNonZeroNumber, parsePdfNumber } from '@/lib/utils/pdf-number';

export interface FuelRecord {
  id: string;
  date: string;
  locCode: string;
  supplyPoint: string;
  time: string;
  route: string;
  locoCode: string;
  locoSeries: string;
  locoNumber: string;
  trainCode: string;
  trainNumber: string;
  moveType: string;
  trainIndex: string;   // stansiya / tashkilot / ijarachi / mashina raqami
  weight: string;
  balanceBefore: string;
  fuelAmount: string;
  zagranitsa?: string;
  zagranitsaAmount?: string;
  maslaAmount: string;
  staffName: string;
  staffCode?: string;
  stansiya?: string;
  tashkilot?: string;
  ijarachi?: string;
  mashinadaYetkazildi?: boolean;
  mashinaRaqami?: string;
}

// ─── PDF raqam formati: minglik ajratgichsiz, kasr bo'lsa kasr qismi bilan ───
const fmt = (val: any): string => {
  return formatPdfNonZeroNumber(val);
};

const toNum = (val: any): number =>
  parsePdfNumber(val);

const esc = (val: unknown): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ─── asosiy generator ────────────────────────────────────────────────────────
export function generateErjuHtmlPdf(records: FuelRecord[], date: string): void {
  // 1. sort: zapravka → xodim kodi → vaqt
  const sorted = [...records].sort((a, b) => {
    if (a.supplyPoint !== b.supplyPoint) return a.supplyPoint.localeCompare(b.supplyPoint, 'uz');
    const aKey = a.staffCode || a.staffName;
    const bKey = b.staffCode || b.staffName;
    if (aKey !== bKey) return aKey.localeCompare(bKey, 'uz');
    return a.time.localeCompare(b.time);
  });

  // 2. guruhla: zapravka + xodim kodi
  type Group = { supplyPoint: string; staffLabel: string; rows: FuelRecord[] };
  const groups: Group[] = [];
  for (const r of sorted) {
    const staffLabel = r.staffCode
      ? `${r.supplyPoint} - ${r.staffCode}`
      : `${r.supplyPoint} - ${r.staffName}`;
    const last = groups[groups.length - 1];
    if (last && last.staffLabel === staffLabel) {
      last.rows.push(r);
    } else {
      groups.push({ supplyPoint: r.supplyPoint, staffLabel, rows: [r] });
    }
  }

  // 3. jami (faqat qoldiq va berilgan)
  const totalBalance = records.reduce((s, r) => s + toNum(r.balanceBefore), 0);
  const totalFuel    = records.reduce((s, r) => s + toNum(r.fuelAmount), 0);

  // 4. sana formati
  const d = new Date(date);
  const dateUz = d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // 5. tbody HTML — 11 ustun
  let tbody = '';
  for (const g of groups) {
    tbody += `<tr class="gr"><td colspan="11">${esc(g.staffLabel)}</td></tr>`;
    for (const r of g.rows) {
      const hisob = toNum(r.balanceBefore) + toNum(r.fuelAmount);
      tbody += `<tr class="dr">
        <td>${esc(r.time)}</td>
        <td>${esc(r.locoSeries)}</td>
        <td>${esc(r.locoCode)}</td>
        <td>${esc(r.moveType)}</td>
        <td>${esc(r.locoNumber)}</td>
        <td>${esc(r.trainIndex)}</td>
        <td class="r">${fmt(r.weight)}</td>
        <td class="r">${fmt(r.maslaAmount)}</td>
        <td class="r">${fmt(r.balanceBefore)}</td>
        <td class="r">${fmt(r.fuelAmount)}</td>
        <td class="r">${fmt(hisob)}</td>
      </tr>`;
    }
  }

  // 6. to'liq HTML
  const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ERJU MA'LUMOTNOMA - ${esc(dateUz)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 9mm; }
  *     { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { min-height: 100%; }
  body  { font-family: Arial, Helvetica, sans-serif; font-size: 9.4px; background: #fff; color: #000; }
  main.report { width: 100%; }
  header.report-header { margin-bottom: 4px; text-align: center; }
  header.report-header h1 { font-size: 10px; font-weight: 700; line-height: 1.25; }

  /* ── asosiy jadval — 11 ustun ── */
  table.main { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.main col:nth-child(1)  { width: 6%;  }
  table.main col:nth-child(2)  { width: 8%;  }
  table.main col:nth-child(3)  { width: 8%;  }
  table.main col:nth-child(4)  { width: 10%; }
  table.main col:nth-child(5)  { width: 9%;  }
  table.main col:nth-child(6)  { width: 10%; }
  table.main col:nth-child(7)  { width: 9%;  }
  table.main col:nth-child(8)  { width: 7%;  }
  table.main col:nth-child(9)  { width: 10%; }
  table.main col:nth-child(10) { width: 8%;  }
  table.main col:nth-child(11) { width: 8%;  }

  th, td { border: 0.6px solid #000; padding: 2px 3px; vertical-align: middle; }
  thead th { text-align: center; font-weight: bold; font-size: 8.5px; line-height: 1.3; }
  thead tr.title th { font-size: 9.5px; padding: 5px 3px; }
  thead tr.nums  th { font-weight: normal; font-size: 8px; }

  /* ── guruh satr ── */
  tr.gr td { padding-left: 10px; text-align: left; font-size: 10.3px; font-weight: 700; border-top: 1.5px solid #000; }

  /* ── ma'lumot satr ── */
  tr.dr td   { font-size: 9px; text-align: left; }
  tr.dr td.r { text-align: right; }

  /* ── jami jadval ── */
  table.totals { margin-top: 8px; margin-left: auto; border-collapse: collapse; }
  table.totals td { border: 0.6px solid #000; padding: 2px 8px; font-size: 9px; }
  table.totals td:last-child { text-align: right; font-weight: bold; min-width: 80px; }
  .empty td { height: 28px; text-align: center; font-style: italic; }

  @media print { body { background: #fff; } }
</style>
</head>
<body>

<main class="report">
<header class="report-header">
  <h1>${esc(dateUz)} kun mobaynida dizel yoqilg'isi tarqatilishi haqida ma'lumotnoma</h1>
</header>

<table class="main">
  <colgroup>
    <col/><col/><col/><col/><col/><col/>
    <col/><col/><col/><col/><col/>
  </colgroup>
  <thead>
    <tr>
      <th rowspan="2">Vaqt</th>
      <th colspan="2">Teplovozlar bo'yicha ma'lumot</th>
      <th colspan="4">Poyezdlar va tashkilotlar bo'yicha ma'lumot</th>
      <th rowspan="2">B.masla</th>
      <th rowspan="2">Qoldiq</th>
      <th rowspan="2">B.yoqilg'i</th>
      <th rowspan="2">Hisob</th>
    </tr>
    <tr>
      <th>Poyezd rusumi</th>
      <th>Raqami</th>
      <th>Harakat turi</th>
      <th>P.Raqami</th>
      <th>Ruxsat indeksi</th>
      <th>Poyezd vazni</th>
    </tr>
    <tr class="nums">
      <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
      <th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th>
    </tr>
  </thead>
  <tbody>
    ${tbody || '<tr class="empty"><td colspan="11">Ma&apos;lumot yo&apos;q</td></tr>'}
  </tbody>
</table>

<footer>
<table class="totals" aria-label="Jami">
  <tr><td>Jami qoldiq yoqilg'i</td><td>${fmt(totalBalance)}</td></tr>
  <tr><td>Jami berilgan yoqilg'i</td><td>${fmt(totalFuel)}</td></tr>
</table>
</footer>
</main>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) {
    alert("Popup bloklangan. Brauzerdagi popup ruxsatini yoqing va qayta bosing.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => win.print());
}
