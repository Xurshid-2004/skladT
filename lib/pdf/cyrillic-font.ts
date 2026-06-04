import type { jsPDF } from "jspdf";

import { GEIST_REGULAR_BASE64 } from "./font-data/geist-regular";

export const PDF_CYRILLIC_FONT = "GeistPdf";

export function useCyrillicPdfFont(doc: jsPDF) {
  const fileName = "Geist-Regular.ttf";
  doc.addFileToVFS(fileName, GEIST_REGULAR_BASE64);
  doc.addFont(fileName, PDF_CYRILLIC_FONT, "normal");
  doc.addFont(fileName, PDF_CYRILLIC_FONT, "bold");
  doc.addFont(fileName, PDF_CYRILLIC_FONT, "italic");
  doc.addFont(fileName, PDF_CYRILLIC_FONT, "bolditalic");
  doc.setFont(PDF_CYRILLIC_FONT, "normal");
}
