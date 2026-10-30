import { HOT_FAM, HOT_THEMES, RIVALS, fnFamily } from "./referentiels";

// Formule du prototype. Chaque composante : points par occurrence, plafond.
export type ScoreWeights = {
  hot: { per: number; max: number };
  moves: { per: number; max: number };
  recent: { per: number; max: number };
  size: { max: number; inTarget: number; above: number; below: number; min: number; maxTarget: number };
  rivals: { per: number; max: number };
  windowDays: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  hot: { per: 8, max: 40 },
  moves: { per: 10, max: 20 },
  recent: { per: 2, max: 15 },
  size: { max: 15, inTarget: 1, above: 0.6, below: 0.3, min: 1000, maxTarget: 20000 },
  rivals: { per: 3, max: 10 },
  windowDays: 90,
};

export type ScoreSignal = { type: string; theme: string | null; function: string | null; date: Date };
export type ScoreInput = { groupHeadcount: number | null; headcount: number | null; signals: ScoreSignal[]; tools: string[] };
export type ScoreResult = { total: number; parts: [string, number][]; last: Date | null; count: number };

export const isHot = (s: { theme: string | null; function: string | null }) =>
  (!!s.theme && HOT_THEMES.has(s.theme)) || (!!s.function && HOT_FAM.has(fnFamily(s.function) ?? ""));

export function computeScore(c: ScoreInput, now: Date = new Date(), w: ScoreWeights = DEFAULT_WEIGHTS): ScoreResult {
  const days = (d: Date) => (now.getTime() - d.getTime()) / 864e5;
  const sigs = [...c.signals].sort((a, b) => b.date.getTime() - a.date.getTime());
  const recent = sigs.filter((s) => days(s.date) <= w.windowDays);
  const hot = recent.filter(isHot);
  const moves = recent.filter((s) => (s.type === "arr" || s.type === "dep") && HOT_FAM.has(fnFamily(s.function) ?? ""));
  const rivals = c.tools.filter((t) => RIVALS.has(t)).length;
  const g = c.groupHeadcount ?? c.headcount ?? 0;
  const size = g >= w.size.min && g <= w.size.maxTarget ? w.size.inTarget : g > w.size.maxTarget ? w.size.above : w.size.below;
  const parts: [string, number][] = [
    [`Signaux à fort intérêt (${w.windowDays} j)`, Math.min(w.hot.max, hot.length * w.hot.per)],
    ["Mouvements RH / SIRH / Paie", Math.min(w.moves.max, moves.length * w.moves.per)],
    ["Activité récente", Math.min(w.recent.max, recent.length * w.recent.per)],
    ["Taille dans la cible", Math.round(size * w.size.max)],
    ["Outils concurrents en place", Math.min(w.rivals.max, rivals * w.rivals.per)],
  ];
  return { total: Math.min(100, parts.reduce((a, p) => a + p[1], 0)), parts, last: sigs[0]?.date ?? null, count: sigs.length };
}
