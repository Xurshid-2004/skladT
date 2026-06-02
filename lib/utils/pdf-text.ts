const CYR_TO_LAT: Record<number, string> = {
  0x0410: 'A', 0x0430: 'a',
  0x0411: 'B', 0x0431: 'b',
  0x0412: 'V', 0x0432: 'v',
  0x0413: 'G', 0x0433: 'g',
  0x0414: 'D', 0x0434: 'd',
  0x0415: 'E', 0x0435: 'e',
  0x0401: 'Yo', 0x0451: 'yo',
  0x0416: 'J', 0x0436: 'j',
  0x0417: 'Z', 0x0437: 'z',
  0x0418: 'I', 0x0438: 'i',
  0x0419: 'Y', 0x0439: 'y',
  0x041A: 'K', 0x043A: 'k',
  0x041B: 'L', 0x043B: 'l',
  0x041C: 'M', 0x043C: 'm',
  0x041D: 'N', 0x043D: 'n',
  0x041E: 'O', 0x043E: 'o',
  0x041F: 'P', 0x043F: 'p',
  0x0420: 'R', 0x0440: 'r',
  0x0421: 'S', 0x0441: 's',
  0x0422: 'T', 0x0442: 't',
  0x0423: 'U', 0x0443: 'u',
  0x0424: 'F', 0x0444: 'f',
  0x0425: 'X', 0x0445: 'x',
  0x0426: 'Ts', 0x0446: 'ts',
  0x0427: 'Ch', 0x0447: 'ch',
  0x0428: 'Sh', 0x0448: 'sh',
  0x0429: 'Shch', 0x0449: 'shch',
  0x042A: "'", 0x044A: "'",
  0x042B: 'I', 0x044B: 'i',
  0x042C: '', 0x044C: '',
  0x042D: 'E', 0x044D: 'e',
  0x042E: 'Yu', 0x044E: 'yu',
  0x042F: 'Ya', 0x044F: 'ya',
  0x040E: "O'", 0x045E: "o'",
  0x049A: 'Q', 0x049B: 'q',
  0x0492: "G'", 0x0493: "g'",
  0x04B2: 'H', 0x04B3: 'h',
  0x04A2: 'Ng', 0x04A3: 'ng',
};

export function pdfText(value: unknown, fallback = '-'): string {
  if (value == null || String(value).trim() === '') return fallback;

  const source = String(value);
  let result = '';

  for (let i = 0; i < source.length; i += 1) {
    const code = source.codePointAt(i);
    if (code == null) continue;
    if (code > 0xffff) i += 1;
    result += CYR_TO_LAT[code] ?? String.fromCodePoint(code);
  }

  return result
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00AB|\u00BB/g, '"');
}
