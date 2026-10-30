// Lecture d'un fichier CSV (séparateur détecté) ou Excel (.xlsx, première feuille).
import Papa from "papaparse";
import ExcelJS from "exceljs";

export type Table = { headers: string[]; rows: Record<string, string>[] };

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return String(v.text);
    if ("result" in v) return v.result == null ? "" : cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String(v.hyperlink);
  }
  return String(v);
};

export async function parseFile(buf: Buffer, fileName: string): Promise<Table> {
  if (/\.xlsx$/i.test(fileName)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (headers[i - 1] = cellText(c.value).trim() || `Colonne ${i}`));
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const r: Record<string, string> = {};
      headers.forEach((h, i) => (r[h] = cellText(row.getCell(i + 1).value).trim()));
      if (Object.values(r).some(Boolean)) rows.push(r);
    });
    return { headers, rows };
  }
  if (/\.xls$/i.test(fileName)) throw new Error("Format .xls non pris en charge : enregistrez le fichier en .xlsx ou .csv.");
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  const rows = res.data.map((r) => Object.fromEntries(headers.map((h) => [h, String(r[h] ?? "").trim()])));
  return { headers, rows };
}
