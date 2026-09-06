export type SpreadsheetSheet = {
  name: string;
  rows: string[][];
};

export function parseDelimitedPreviewRows(text: string, delimiter: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(delimiter));
}
