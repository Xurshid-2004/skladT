const REPORT_DATE_OVERRIDE_KEY = "uz_temiryo_report_date_override";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBrowser() {
  return typeof window !== "undefined";
}

export function isValidReportDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function getReportDateOverride(): string {
  if (!isBrowser()) return "";
  const value = window.sessionStorage.getItem(REPORT_DATE_OVERRIDE_KEY) ?? "";
  return isValidReportDate(value) ? value : "";
}

export function setReportDateOverride(value: string): void {
  if (!isBrowser()) return;
  if (isValidReportDate(value)) {
    window.sessionStorage.setItem(REPORT_DATE_OVERRIDE_KEY, value);
  } else {
    window.sessionStorage.removeItem(REPORT_DATE_OVERRIDE_KEY);
  }
  window.dispatchEvent(new CustomEvent("report-date-override-change"));
}

export function buildReportDate(base: Date = new Date()): Date {
  const override = getReportDateOverride();
  if (!override) return base;

  const [year, month, day] = override.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds(),
  );
}
