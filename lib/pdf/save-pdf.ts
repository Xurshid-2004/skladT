type PdfDocument = {
  save: (filename: string) => void;
  output: (type: "blob") => Blob;
};

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function savePdfDocument(doc: PdfDocument, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !isMobileBrowser()) {
    doc.save(filename);
    return;
  }

  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    if (isIosBrowser()) link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    doc.save(filename);
  }
}
