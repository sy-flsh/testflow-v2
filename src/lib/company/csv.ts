/**
 * c9-8: 안전한 CSV 직렬화 helper (RFC 4180 + formula injection 방지).
 * 외부에서 Excel/스프레드시트로 열어도 수식이 실행되지 않도록 string cell 을 방어한다.
 */

/** Excel 한글 깨짐 방지용 UTF-8 BOM. */
export const CSV_BOM = "﻿";

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * 한 cell 직렬화:
 * 1) `= + - @` 로 시작하면 앞에 `'` 를 붙여 formula injection 방지(quote 전에 적용).
 * 2) comma/quote/newline 포함 시 quote 로 감싸고 내부 `"` 는 `""` 로 escape.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (text.length > 0 && FORMULA_PREFIXES.includes(text[0])) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/** cell 배열 → CSV 한 줄. */
export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}
