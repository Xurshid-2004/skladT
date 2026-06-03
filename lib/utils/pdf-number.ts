export function parsePdfNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = normalizePdfNumberString(raw);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePdfNumberString(raw: string): string {
  const compact = raw.replace(/\s/g, '');
  if (!compact) return '';

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const decimalSeparator = compact.lastIndexOf(',') > compact.lastIndexOf('.') ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    return compact
      .replace(new RegExp(`\\${groupingSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  }

  if (commaCount > 0) {
    const parts = compact.split(',');
    const last = parts.at(-1) ?? '';
    const first = parts[0] ?? '';
    const isGroupedInteger =
      parts.length > 1 &&
      /^-?\d{1,3}$/.test(first) &&
      parts.slice(1).every((part) => /^\d{3}$/.test(part));

    if (isGroupedInteger) return parts.join('');
    if (parts.length > 1) return `${parts.slice(0, -1).join('')}.${last}`;
  }

  if (dotCount > 1) {
    const parts = compact.split('.');
    const last = parts.at(-1) ?? '';
    return `${parts.slice(0, -1).join('')}.${last}`;
  }

  return compact;
}

export function formatPdfNumber(value: unknown, maxFractionDigits = 3): string {
  const n = parsePdfNumber(value);
  const sign = n < 0 ? '-' : '';
  const multiplier = 10 ** maxFractionDigits;
  const rounded = Math.round(Math.abs(n) * multiplier) / multiplier;
  const [integerPart, fractionPart = ''] = rounded.toFixed(maxFractionDigits).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFraction = fractionPart.replace(/0+$/, '');

  if (!trimmedFraction) return `${sign}${groupedInteger}`;

  const decimalSeparator = Number(integerPart) >= 1000 ? '.' : ',';
  return `${sign}${groupedInteger}${decimalSeparator}${trimmedFraction}`;
}

export function formatPdfNonZeroNumber(value: unknown, fallback = '', maxFractionDigits = 3): string {
  const n = parsePdfNumber(value);
  if (n === 0) return fallback;
  return formatPdfNumber(n, maxFractionDigits);
}
