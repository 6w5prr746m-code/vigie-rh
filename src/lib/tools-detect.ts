// Repérage des outils du référentiel OUTILS cités dans un texte (offre d'emploi).
import { toolCategory } from "./referentiels";

// Motifs par outil. Les sigles ambigus (ADP, Sage, Lucca…) exigent la casse exacte ou un contexte.
const PATTERNS: [string, RegExp][] = [
  ["ADP", /\bADP\b(?! ?(?:aéroport|aeroport))|\bDecidium\b|\bADP GXP\b/],
  ["Cegid Paie", /\bCegid (?:Paie|HR Ultimate|Peoplenet|XRP)\b|\bMeta4\b/i],
  ["HR Access", /\bHR ?Access\b|\b4YOU\b/i],
  ["SAP HCM", /\bSAP (?:HCM|HR|RH|Payroll|Paie)\b/i],
  ["Silae", /\bSilae\b/i],
  ["Talentia", /\bTalentia\b/i],
  ["Sage Paie", /\bSage (?:Paie|RH|HR|1000|X3 Paie)\b/i],
  ["PayFit", /\bPay ?fit\b/i],
  ["Pléiades", /\bPl[ée]iades\b/i],
  ["Nibelis", /\bNibelis\b/i],
  ["Workday", /\bWorkday\b/i],
  ["SAP SuccessFactors", /\bSuccess ?Factors\b/i],
  ["Oracle HCM", /\bOracle (?:Cloud )?HCM\b|\bOracle Fusion HCM\b/i],
  ["Lucca", /\bLucca\b(?! ?(?:Italie|Italy))/],
  ["PeopleSpheres", /\bPeople ?Spheres\b/i],
  ["Eurécia", /\bEur[ée]cia\b/i],
  ["Horoquartz", /\bHoroquartz\b|\beTemptation\b/i],
  ["Chronotime", /\bChronotime\b/i],
  ["Octime", /\bOctime\b/i],
  ["Kelio", /\bKelio\b|\bBodet Software\b/i],
  ["UKG Pro WFM", /\bUKG\b|\bKronos\b/],
  ["Cornerstone", /\bCornerstone\b(?! ?(?:OnDemand Foundation))/i],
  ["Talentsoft - Cegid HR", /\bTalent ?soft\b/i],
  ["365Talents", /\b365 ?Talents\b/i],
  ["360Learning", /\b360 ?Learning\b/i],
  ["Digital Recruiters", /\bDigital ?Recruiters\b/i],
];

/** Outils distincts cités dans le texte, avec leur catégorie. */
export function detectTools(text: string): { tool: string; category: string }[] {
  if (!text) return [];
  return PATTERNS.filter(([, re]) => re.test(text)).map(([tool]) => ({ tool, category: toolCategory(tool) ?? "Autre" }));
}

/** Confiance 1-5 selon le nombre d'offres distinctes citant l'outil. */
export const confidenceFromMentions = (n: number) => Math.max(1, Math.min(5, n + 1));
