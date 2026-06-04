const EXACT_RU: Record<string, string> = {
  yuk: "Груз.",
  manyovr: "Маневр.",
  маневр: "Маневр.",
  yolovchi: "Пасс.",
  "yo'lovchi": "Пасс.",
  xojalik: "Хоз.",
  "xo'jalik": "Хоз.",
  ijara: "Аренда",
  arenda: "Аренда",
  korxona: "Предпр.",
  predpriyatie: "Предпр.",
  qurulish: "Строит-во",
  qurilish: "Строит-во",
  stroitelstvo: "Строит-во",
  tamirlash: "Ремонт",
  "ta'mirlash": "Ремонт",
  remont: "Ремонт",
  norma: "Норма",
  "yo'q": "Нет",
  yoq: "Нет",
  yuq: "Нет",
  ha: "Да",
};

const SERIES_RU: Array<[RegExp, string]> = [
  [/\b2TE10M\b/gi, "2ТЭ10М"],
  [/\b3TE10M\b/gi, "3ТЭ10М"],
  [/\b2TE\b/gi, "2ТЭ"],
  [/\b3TE\b/gi, "3ТЭ"],
  [/\bTEM2\b/gi, "ТЭМ2"],
  [/\bCHME[-\s]?3\b/gi, "ЧМЭ-3"],
  [/\bCHME\b/gi, "ЧМЭ"],
];

const MULTI_LAT_TO_RU: Array<[string, string]> = [
  ["shch", "щ"],
  ["sch", "щ"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ye", "е"],
  ["ts", "ц"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ng", "нг"],
  ["o'", "у"],
  ["o`", "у"],
  ["oʻ", "у"],
  ["oʼ", "у"],
  ["o‘", "у"],
  ["o’", "у"],
  ["g'", "г"],
  ["g`", "г"],
  ["gʻ", "г"],
  ["gʼ", "г"],
  ["g‘", "г"],
  ["g’", "г"],
];

const LAT_TO_RU: Record<string, string> = {
  a: "а",
  b: "б",
  c: "к",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "ж",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "х",
  y: "й",
  z: "з",
};

const UZ_CYR_TO_RU: Record<string, string> = {
  "Ў": "У",
  "ў": "у",
  "Қ": "К",
  "қ": "к",
  "Ғ": "Г",
  "ғ": "г",
  "Ҳ": "Х",
  "ҳ": "х",
  "Ң": "Нг",
  "ң": "нг",
};

function applyCase(source: string, target: string): string {
  if (source === source.toUpperCase()) return target.toUpperCase();
  const first = source[0];
  const rest = source.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

function normalizePunctuation(value: string): string {
  return value
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019|\u02bb|\u02bc/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00AB|\u00BB/g, '"');
}

function applyExactTerms(value: string): string {
  const clean = normalizePunctuation(value).trim().toLowerCase();
  if (EXACT_RU[clean]) return EXACT_RU[clean];

  let result = value;
  for (const [pattern, replacement] of SERIES_RU) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/limitdan oshgan/gi, "Превышен лимит");
  return result;
}

export function toRussianCyrillic(value: unknown, fallback = "-"): string {
  if (value == null || String(value).trim() === "") return fallback;

  const prepared = applyExactTerms(String(value));
  const source = normalizePunctuation(prepared);
  let result = "";

  for (let i = 0; i < source.length; i += 1) {
    const slice = source.slice(i);
    const lowerSlice = slice.toLowerCase();
    const multi = MULTI_LAT_TO_RU.find(([token]) => lowerSlice.startsWith(token));

    if (multi) {
      const [token, replacement] = multi;
      const original = source.slice(i, i + token.length);
      result += applyCase(original, replacement);
      i += token.length - 1;
      continue;
    }

    const char = source[i];
    const ruCyr = UZ_CYR_TO_RU[char];
    if (ruCyr) {
      result += ruCyr;
      continue;
    }

    const lower = char.toLowerCase();
    const translated = LAT_TO_RU[lower];
    result += translated ? applyCase(char, translated) : char;
  }

  return normalizePunctuation(result).replace(/([А-Яа-яЁё])'([А-Яа-яЁё])/g, "$1$2");
}

export function pdfText(value: unknown, fallback = "-"): string {
  return toRussianCyrillic(value, fallback);
}
