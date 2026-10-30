// Génération CSV (UTF-8 avec BOM pour Excel / HubSpot)
const cell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (headers: string[], rows: unknown[][]) => "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
