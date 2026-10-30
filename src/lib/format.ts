export const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

export const fmtDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function rel(d: Date | null | undefined, now = new Date()) {
  if (!d) return "Aucun";
  const n = Math.floor((now.getTime() - d.getTime()) / 864e5);
  return n < 1 ? "aujourd'hui" : n === 1 ? "hier" : n < 14 ? `il y a ${n} j` : n < 60 ? `il y a ${Math.round(n / 7)} sem.` : `il y a ${Math.round(n / 30)} mois`;
}

export const formatSiren = (s: string | null) => (s ? s.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : "—");
