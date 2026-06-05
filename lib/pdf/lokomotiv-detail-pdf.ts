import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { formatPdfNumber, parsePdfNumber } from "@/lib/utils/pdf-number";
import { pdfText } from "@/lib/utils/pdf-text";
import { PDF_CYRILLIC_FONT, useCyrillicPdfFont } from "@/lib/pdf/cyrillic-font";

const HARAKAT_LABEL: Record<string, string> = {
  yuk: "Yuk",
  manyovr: "Manyovr",
  yolovchi: "Yo'lovchi",
  xojalik: "Xo'jalik",
  ijara: "Ijara",
  arenda: "Ijara",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDmy(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function toIsoDateLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getRowDate(row: any): Date | null {
  const ts = row?.timestamp ?? row?.createdAt;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  const numeric = Number(ts);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric);
  return null;
}

function rowCreatedMs(row: any): number {
  const d = getRowDate(row);
  if (d) return d.getTime();

  const date = String(row?.dateISO ?? row?.date ?? "").trim();
  const time = String(row?.time ?? "").trim();
  const parsed = date && time ? Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}`) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRowsOldestFirst<T>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = rowCreatedMs(a.row) - rowCreatedMs(b.row);
      return diff || a.index - b.index;
    })
    .map(({ row }) => row);
}

function fmtTime(row: any) {
  const d = getRowDate(row);
  if (!d) return "-";
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function textVal(raw: unknown, fallback = "-") {
  if (raw == null || String(raw).trim() === "") return fallback;
  return String(raw);
}

function numVal(raw: unknown, fallback = "-") {
  if (raw == null || String(raw).trim() === "") return fallback;
  return formatPdfNumber(parsePdfNumber(raw));
}

function stationName(stationId: string) {
  return ZAPRAVKALAR.find((z) => z.id === stationId)?.name ?? stationId;
}

function directionValue(row: any) {
  if (row?.harakatTuri === "manyovr") return textVal(row?.stansiya);
  if (row?.harakatTuri === "xojalik") return textVal(row?.tashkilot);
  if (row?.harakatTuri === "ijara" || row?.harakatTuri === "arenda") return textVal(row?.ijarachi);
  return "-";
}

function staffName(row: any, staffMap?: Map<string, string>) {
  const code = String(row?.staffCode ?? "").trim();
  return textVal((code && staffMap?.get(code)) || row?.staffName || code);
}

type StationStaffGroup = {
  stationId: string;
  staffName: string;
  rows: any[];
};

function staffGroupName(row: any, staffMap?: Map<string, string>) {
  const code = String(row?.staffCode ?? "").trim();
  const byCode = code && staffMap ? staffMap.get(code) : undefined;
  return String(byCode ?? row?.staffName ?? code ?? "").trim();
}

function staffGroupKey(row: any) {
  const code = String(row?.staffCode ?? "").trim();
  if (code) return `code:${code}`;

  const name = String(row?.staffName ?? "").trim();
  if (name) return `name:${name.toLowerCase()}`;

  return "unknown";
}

function groupRowsByStationAndStaff(rows: any[], staffMap?: Map<string, string>): StationStaffGroup[] {
  const groups = new Map<string, StationStaffGroup>();

  for (const row of rows) {
    const stationId = String(row?.stationId ?? "other");
    const groupKey = `${stationId}__${staffGroupKey(row)}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        stationId,
        staffName: staffGroupName(row, staffMap),
        rows: [],
      });
    }
    groups.get(groupKey)!.rows.push(row);
  }

  return [...groups.values()];
}

function mashinaValue(row: any) {
  if (!row?.mashinadaYetkazildi) return "Yo'q";
  return row?.mashinaRaqami ? `Ha / ${row.mashinaRaqami}` : "Ha";
}

export function buildLokomotivDetailPdfTitle(start: Date, end?: Date) {
  if (!end || sameDate(start, end)) {
    return `${toDmy(start)} данные по разделу локомотив`;
  }
  return `${toDmy(start)} - ${toDmy(end)} данные по разделу локомотив`;
}

export function buildCategoryDetailPdfTitle(category: "korxona" | "qurulish" | "tamirlash", start: Date, end?: Date) {
  const categoryTitle: Record<"korxona" | "qurulish" | "tamirlash", string> = {
    korxona: "раздел предприятие",
    qurulish: "раздел строительство",
    tamirlash: "раздел ремонт",
  };
  const label = categoryTitle[category];
  if (!end || sameDate(start, end)) {
    return `${toDmy(start)} данные по ${label}`;
  }
  return `${toDmy(start)} - ${toDmy(end)} данные по ${label}`;
}

interface ExportLokomotivDetailPdfOptions {
  fileSlug: string;
  titleLine: string;
  staffMap?: Map<string, string>;
  showDateGroups?: boolean;
}

export function exportLokomotivDetailPdf(
  rows: any[],
  { fileSlug, titleLine, staffMap, showDateGroups = false }: ExportLokomotivDetailPdfOptions,
) {
  const sortedRows = sortRowsOldestFirst(rows);
  const doc = new jsPDF("landscape", "mm", "a4");
  useCyrillicPdfFont(doc);
  const pageWidth = doc.internal.pageSize.width;
  const tableWidth = 274;
  const tableMarginX = (pageWidth - tableWidth) / 2;

  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(9);
  const titleLines = doc.splitTextToSize(pdfText(titleLine), tableWidth);
  let titleY = 8.5;
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, titleY, { align: "center" });
    titleY += 4.2;
  });
  doc.setFont(PDF_CYRILLIC_FONT, "normal");

  const head = [[
    "Время",
    "Заправка",
    "Вид движения",
    "Серия",
    "Номер лок.",
    "Депо",
    "Номер поезда",
    "Направление / организация",
    "Индекс",
    "Вес",
    "Остаток",
    "Выдано",
    "Диз.масло",
    "Заграница",
    "Машина",
    "Ответственный",
  ]];

  const body: any[] = [];
  const dateGroups = new Map<string, any[]>();
  for (const row of sortedRows) {
    const d = getRowDate(row);
    const key = d ? toIsoDateLocal(d) : "0000-00-00";
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key)!.push(row);
  }

  const dateKeys = showDateGroups ? [...dateGroups.keys()].sort() : ["all"];
  const dateRowsFor = (dateKey: string) => (dateKey === "all" ? sortedRows : dateGroups.get(dateKey) ?? []);

  for (const dateKey of dateKeys) {
    const dateRows = dateRowsFor(dateKey);
    if (!dateRows.length) continue;

    if (showDateGroups && dateKey !== "all") {
      const [year, month, day] = dateKey.split("-");
      body.push([{
        content: `${day}.${month}.${year}`,
        colSpan: head[0].length,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          fillColor: [30, 50, 30],
          textColor: [255, 220, 50],
          fontSize: 7,
          cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 },
        },
      }]);
    }

    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const sid = group.stationId;
      const stationRows = group.rows;
      const groupTitle = group.staffName ? `${stationName(sid)} - ${group.staffName}` : stationName(sid);
      const total = stationRows.reduce((sum, row) => sum + parsePdfNumber(row?.qanchaBerildi ?? 0), 0);
      body.push([
        {
          content: pdfText(groupTitle),
          colSpan: 10,
          styles: {
            halign: "left" as const,
            fontStyle: "bold" as const,
            fillColor: [210, 220, 210],
            textColor: [30, 60, 30],
            fontSize: 7,
            cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          },
        },
        {
          content: `итого: ${formatPdfNumber(total)} кг`,
          colSpan: 6,
          styles: {
            halign: "right" as const,
            fontStyle: "italic" as const,
            fillColor: [210, 220, 210],
            textColor: [30, 60, 30],
            fontSize: 7,
            cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          },
        },
      ]);

      for (const row of stationRows) {
        body.push([
          fmtTime(row),
          pdfText(stationName(String(row?.stationId ?? sid))),
          pdfText(HARAKAT_LABEL[row?.harakatTuri] ?? row?.harakatTuri ?? "-"),
          pdfText(row?.rusumi ?? row?.seriya ?? "-"),
          pdfText(row?.lokomotivNumber ?? row?.raqami ?? "-"),
          pdfText(textVal(row?.jadval)),
          pdfText(textVal(row?.poyezdNumber)),
          pdfText(directionValue(row)),
          pdfText(textVal(row?.ruxsatIndeksi)),
          numVal(row?.poyezdVazni),
          numVal(row?.qoldiq),
          numVal(row?.qanchaBerildi),
          numVal(row?.dizMasla),
          numVal(row?.zagranitsa),
          pdfText(mashinaValue(row)),
          pdfText(staffName(row, staffMap)),
        ]);
      }
    }
  }

  autoTable(doc, {
    head,
    body,
    startY: titleY + 1,
    theme: "grid",
    tableWidth,
    margin: { left: tableMarginX, right: tableMarginX },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 5.5,
      cellPadding: 0.65,
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.16,
      overflow: "linebreak",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 5.7,
      lineColor: [0, 0, 0],
      lineWidth: 0.24,
      cellPadding: 0.65,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 17 },
      2: { cellWidth: 15 },
      3: { cellWidth: 14 },
      4: { cellWidth: 15 },
      5: { cellWidth: 17 },
      6: { cellWidth: 18 },
      7: { cellWidth: 19 },
      8: { cellWidth: 17 },
      9: { cellWidth: 14, halign: "right" as const },
      10: { cellWidth: 17, halign: "right" as const },
      11: { cellWidth: 17, halign: "right" as const },
      12: { cellWidth: 15, halign: "right" as const },
      13: { cellWidth: 14, halign: "right" as const },
      14: { cellWidth: 16 },
      15: { cellWidth: 22 },
    },
  });

  const totalFuel = sortedRows.reduce((sum, row) => sum + parsePdfNumber(row?.qanchaBerildi ?? 0), 0);
  const totalMasla = sortedRows.reduce((sum, row) => sum + parsePdfNumber(row?.dizMasla ?? 0), 0);
  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
  const pageHeight = doc.internal.pageSize.height;
  let footerY = finalY + 8;
  if (footerY > pageHeight - 14) {
    doc.addPage();
    footerY = 14;
  }

  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(8);
  doc.text(`Всего выдано топлива: ${formatPdfNumber(totalFuel)} кг`, tableMarginX, footerY);
  if (totalMasla > 0) {
    doc.text(`Всего диз. масла: ${formatPdfNumber(totalMasla)} кг`, tableMarginX, footerY + 5);
  }

  const safeSlug = fileSlug.replace(/[^\w.-]+/g, "_");
  doc.save(`lokomotiv_${safeSlug}.pdf`);
}

type DetailCategory = "korxona" | "qurulish" | "tamirlash";

interface ExportCategoryDetailPdfOptions {
  category: DetailCategory;
  fileSlug: string;
  titleLine: string;
  staffMap?: Map<string, string>;
  showDateGroups?: boolean;
}

function buyruqTimeValue(raw: unknown) {
  if (raw == null || String(raw).trim() === "") return "-";
  const d = new Date(Number(raw));
  if (!Number.isFinite(d.getTime())) return "-";
  return `${toDmy(d)} ${d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function tamirTuriValue(raw: unknown) {
  const key = String(raw ?? "");
  const labels: Record<string, string> = {
    katta: "Капитальный ремонт",
    kichik: "Малый ремонт",
    profilaktika: "Профилактика",
  };
  return labels[key] ?? textVal(raw);
}

function categoryConfig(category: DetailCategory) {
  if (category === "korxona") {
    return {
      filePrefix: "predpriyatie",
      stationColSpan: 6,
      totalColSpan: 7,
      head: [[
        "Время",
        "Заправка",
        "Номер поезда",
        "Индекс",
        "Количество (кг)",
        "Сутки",
        "Лимит (кг)",
        "Приказ N",
        "Кем выдан",
        "Время приказа",
        "Машина",
        "Ответственный",
        "Код",
      ]],
      row: (row: any, map?: Map<string, string>) => [
        fmtTime(row),
        pdfText(stationName(String(row?.stationId ?? "other"))),
        pdfText(textVal(row?.poyezdNumber)),
        pdfText(textVal(row?.ruxsatIndeksi)),
        numVal(row?.qancha),
        textVal(row?.nechaSutkalik),
        numVal(row?.limit),
        pdfText(textVal(row?.buyruqNumber)),
        pdfText(textVal(row?.kimTomonidan)),
        buyruqTimeValue(row?.buyruqVaqti),
        pdfText(mashinaValue(row)),
        pdfText(staffName(row, map)),
        pdfText(textVal(row?.staffCode)),
      ],
      total: (row: any) => parsePdfNumber(row?.qancha ?? 0),
      footerLabel: "Всего выдано",
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22, halign: "right" as const },
        5: { cellWidth: 20 },
        6: { cellWidth: 22, halign: "right" as const },
        7: { cellWidth: 20 },
        8: { cellWidth: 32 },
        9: { cellWidth: 25 },
        10: { cellWidth: 23 },
        11: { cellWidth: 31 },
        12: { cellWidth: 19 },
      },
    };
  }

  if (category === "qurulish") {
    return {
      filePrefix: "stroitelstvo",
      stationColSpan: 6,
      totalColSpan: 7,
      head: [[
        "Время",
        "Заправка",
        "Серия",
        "Номер",
        "Станция",
        "Индекс",
        "Остаток в баке (кг)",
        "Выдано топлива (кг)",
        "Вес поезда",
        "Лимит (кг)",
        "Статус",
        "Ответственный",
        "Код",
      ]],
      row: (row: any, map?: Map<string, string>) => [
        fmtTime(row),
        pdfText(stationName(String(row?.stationId ?? "other"))),
        pdfText(textVal(row?.seriya ?? row?.rusumi)),
        pdfText(textVal(row?.raqami ?? row?.lokomotivNumber)),
        pdfText(textVal(row?.poyezdNumber)),
        pdfText(textVal(row?.ruxsatIndeksi)),
        numVal(row?.qoldiq),
        numVal(row?.qanchaBerildi ?? row?.qanchaOlindi),
        numVal(row?.poyezdVazni),
        numVal(row?.limit),
        pdfText(row?.isOverLimit ? `Limitdan oshgan ${formatPdfNumber(parsePdfNumber(row?.oshiqMiqdor ?? 0))} kg` : "Norma"),
        pdfText(staffName(row, map)),
        pdfText(textVal(row?.staffCode)),
      ],
      total: (row: any) => parsePdfNumber(row?.qanchaBerildi ?? row?.qanchaOlindi ?? 0),
      footerLabel: "Всего выдано",
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 22 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 24 },
        5: { cellWidth: 24 },
        6: { cellWidth: 24, halign: "right" as const },
        7: { cellWidth: 25, halign: "right" as const },
        8: { cellWidth: 22, halign: "right" as const },
        9: { cellWidth: 20, halign: "right" as const },
        10: { cellWidth: 28 },
        11: { cellWidth: 34 },
        12: { cellWidth: 23 },
      },
    };
  }

  return {
    filePrefix: "remont",
    stationColSpan: 5,
    totalColSpan: 6,
    head: [[
      "Время",
      "Заправка",
      "Серия",
      "Номер",
      "Вид ремонта",
      "Выдано (кг)",
      "Диз.масло (кг)",
      "Ответственный",
      "Машина",
      "Сотрудник",
      "Код",
    ]],
    row: (row: any, map?: Map<string, string>) => [
      fmtTime(row),
      pdfText(stationName(String(row?.stationId ?? "other"))),
      pdfText(textVal(row?.seriya)),
      pdfText(textVal(row?.raqami)),
      pdfText(tamirTuriValue(row?.tamirlashTuri)),
      numVal(row?.qanchaBerildi),
      numVal(row?.dizMasla),
      pdfText(textVal(row?.masulShaxs)),
      pdfText(mashinaValue(row)),
      pdfText(staffName(row, map)),
      pdfText(textVal(row?.staffCode)),
    ],
    total: (row: any) => parsePdfNumber(row?.qanchaBerildi ?? 0),
    extraTotal: (row: any) => parsePdfNumber(row?.dizMasla ?? 0),
    footerLabel: "Всего топлива",
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 38 },
      5: { cellWidth: 28, halign: "right" as const },
      6: { cellWidth: 25, halign: "right" as const },
      7: { cellWidth: 42 },
      8: { cellWidth: 28 },
      9: { cellWidth: 34 },
      10: { cellWidth: 21 },
    },
  };
}

export function exportCategoryDetailPdf(
  rows: any[],
  { category, fileSlug, titleLine, staffMap, showDateGroups = false }: ExportCategoryDetailPdfOptions,
) {
  const config = categoryConfig(category);
  const sortedRows = sortRowsOldestFirst(rows);
  const doc = new jsPDF("landscape", "mm", "a4");
  useCyrillicPdfFont(doc);
  const pageWidth = doc.internal.pageSize.width;
  const tableWidth = 274;
  const tableMarginX = (pageWidth - tableWidth) / 2;

  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(9);
  const titleLines = doc.splitTextToSize(pdfText(titleLine), tableWidth);
  let titleY = 8.5;
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, titleY, { align: "center" });
    titleY += 4.2;
  });
  doc.setFont(PDF_CYRILLIC_FONT, "normal");

  const body: any[] = [];
  const dateGroups = new Map<string, any[]>();
  for (const row of sortedRows) {
    const d = getRowDate(row);
    const key = d ? toIsoDateLocal(d) : "0000-00-00";
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key)!.push(row);
  }

  const dateKeys = showDateGroups ? [...dateGroups.keys()].sort() : ["all"];
  const dateRowsFor = (dateKey: string) => (dateKey === "all" ? sortedRows : dateGroups.get(dateKey) ?? []);
  const columnCount = config.head[0].length;

  for (const dateKey of dateKeys) {
    const dateRows = dateRowsFor(dateKey);
    if (!dateRows.length) continue;

    if (showDateGroups && dateKey !== "all") {
      const [year, month, day] = dateKey.split("-");
      body.push([{
        content: `${day}.${month}.${year}`,
        colSpan: columnCount,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          fillColor: [30, 50, 30],
          textColor: [255, 220, 50],
          fontSize: 7,
          cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 },
        },
      }]);
    }

    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const sid = group.stationId;
      const stationRows = group.rows;
      const groupTitle = group.staffName ? `${stationName(sid)} - ${group.staffName}` : stationName(sid);
      const total = stationRows.reduce((sum, row) => sum + config.total(row), 0);
      body.push([
        {
          content: pdfText(groupTitle),
          colSpan: config.stationColSpan,
          styles: {
            halign: "left" as const,
            fontStyle: "bold" as const,
            fillColor: [210, 220, 210],
            textColor: [30, 60, 30],
            fontSize: 7,
            cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          },
        },
        {
          content: `итого: ${formatPdfNumber(total)} кг`,
          colSpan: config.totalColSpan,
          styles: {
            halign: "right" as const,
            fontStyle: "italic" as const,
            fillColor: [210, 220, 210],
            textColor: [30, 60, 30],
            fontSize: 7,
            cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          },
        },
      ]);

      for (const row of stationRows) {
        body.push(config.row(row, staffMap));
      }
    }
  }

  autoTable(doc, {
    head: config.head,
    body,
    startY: titleY + 1,
    theme: "grid",
    tableWidth,
    margin: { left: tableMarginX, right: tableMarginX },
    styles: {
      font: PDF_CYRILLIC_FONT,
      fontSize: 5.8,
      cellPadding: 0.7,
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.16,
      overflow: "linebreak",
    },
    headStyles: {
      font: PDF_CYRILLIC_FONT,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 6,
      lineColor: [0, 0, 0],
      lineWidth: 0.24,
      cellPadding: 0.7,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: config.columnStyles as any,
  });

  const total = sortedRows.reduce((sum, row) => sum + config.total(row), 0);
  const extraTotal = "extraTotal" in config && typeof config.extraTotal === "function"
    ? sortedRows.reduce((sum, row) => sum + config.extraTotal(row), 0)
    : 0;
  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
  const pageHeight = doc.internal.pageSize.height;
  let footerY = finalY + 8;
  if (footerY > pageHeight - 14) {
    doc.addPage();
    footerY = 14;
  }

  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  doc.setFontSize(8);
  doc.text(`${config.footerLabel}: ${formatPdfNumber(total)} кг`, tableMarginX, footerY);
  if (extraTotal > 0) {
    doc.text(`Всего диз. масла: ${formatPdfNumber(extraTotal)} кг`, tableMarginX, footerY + 5);
  }

  const safeSlug = fileSlug.replace(/[^\w.-]+/g, "_");
  doc.save(`${config.filePrefix}_${safeSlug}.pdf`);
}
