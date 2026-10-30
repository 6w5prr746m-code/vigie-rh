// Intitulé de poste libre → fonction normalisée du référentiel (et sa famille).
import { fnFamily } from "./referentiels";
import { stripAccents } from "./normalize";

type Rule = { match: RegExp; pick: (t: string) => string };

const has = (t: string, re: RegExp) => re.test(t);
const isDirector = (t: string) => has(t, /\b(directeur|directrice|director|head of|vp|vice[- ]president|chief)\b/);
const isManager = (t: string) => has(t, /\b(responsable|manager|lead)\b/);
const isProject = (t: string) => has(t, /\b(chef de projet|cheffe de projet|project manager|project lead|product owner)\b/);

// L'ordre compte : du plus spécifique (SIRH, paie, GTA) au plus général (RH).
const RULES: Rule[] = [
  {
    match: /\b(sirh|hris|hrms|systemes? d'information (rh|ressources humaines)|hr systems?)\b/,
    pick: (t) => (isProject(t) ? "Chef de projet SIRH" : isDirector(t) ? "Directeur SIRH" : isManager(t) ? "Responsable SIRH" : has(t, /\b(charge|chargee|analyste|analyst|consultant|administrat|specialist)/) ? "Chargé SIRH" : "Responsable SIRH"),
  },
  {
    match: /\b(paie|payroll|remuneration et paie|c&b paie)\b/,
    pick: (t) => (isProject(t) ? "Chef de projet paie" : isDirector(t) ? "Directeur paie" : isManager(t) ? "Responsable paie" : has(t, /\b(gestionnaire|technicien|technicienne|comptable|specialist|assistant|assistante|officer)\b/) ? "Gestionnaire de paie" : "Responsable paie"),
  },
  {
    match: /\b(gta|gestion des temps|temps et activites?|time (and|&) attendance|wfm|workforce management)\b/,
    pick: (t) => (isProject(t) ? "Chef de projet GTA" : isManager(t) || isDirector(t) ? "Responsable GTA" : "Gestionnaire GTA"),
  },
  {
    match: /\b(formation|learning|training|talents?|developpement des competences|l&d)\b/,
    pick: (t) => (has(t, /\btalents?\b/) && !has(t, /formation|learning|training/) ? "Responsable talents" : isDirector(t) ? "Directeur formation" : isManager(t) ? "Responsable formation" : "Chargé de formation"),
  },
  { match: /\b(transformation (digitale|numerique)|digital transformation|chief digital officer|cdo)\b/, pick: () => "Transformation digitale" },
  { match: /\b(dsi|cio|chief information officer|directeur des systemes d'information|directrice des systemes d'information|directeur informatique|directrice informatique|it director|head of it)\b/, pick: () => "DSI" },
  {
    match: /\b(drh|rh|ressources humaines|hr|human resources|people|personnel|hrbp|chro|relations sociales)\b/,
    pick: (t) => (has(t, /\b(drh|chro|chief people|chief human)\b/) || (isDirector(t) && !has(t, /\badjoint|adjointe|deputy\b/)) ? "DRH" : "Responsable RH"),
  },
];

export function normalizeTitle(raw: string | null | undefined): { function: string | null; functionFamily: string | null } {
  if (!raw) return { function: null, functionFamily: null };
  const t = stripAccents(raw.toLowerCase()).replace(/[’`]/g, "'");
  const rule = RULES.find((r) => r.match.test(t));
  const fn = rule ? rule.pick(t) : null;
  return { function: fn, functionFamily: fnFamily(fn) };
}
