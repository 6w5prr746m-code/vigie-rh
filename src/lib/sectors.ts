// Rattachement au référentiel SECTEURS depuis un code NAF ou un libellé libre (ex. secteur HubSpot).
import { SECTEURS } from "./referentiels";
import { stripAccents } from "./normalize";

/** Division NAF (2 chiffres) → secteur. Quelques sous-classes spécifiques sont traitées avant. */
export function sectorFromNaf(naf: string | null | undefined): string | null {
  if (!naf) return null;
  const code = naf.replace(/\./g, "").toUpperCase();
  if (/^303/.test(code)) return "Aéronautique";
  if (/^(1512|1413|3212|3213|2042)/.test(code)) return "Luxe";
  const d = Number(code.slice(0, 2));
  if (!Number.isFinite(d)) return null;
  const ranges: [number, number, string][] = [
    [1, 3, "Agroalimentaire"], [5, 9, "Énergie"], [10, 12, "Agroalimentaire"], [13, 18, "Industrie"], [19, 19, "Énergie"],
    [20, 20, "Chimie"], [21, 21, "Industrie Pharma"], [22, 28, "Industrie"], [29, 29, "Automobile"], [30, 33, "Industrie"],
    [35, 35, "Énergie"], [36, 39, "Environnement"], [41, 43, "BTP / Immobilier"], [45, 45, "Automobile"], [46, 47, "Commerce / Négoce"],
    [49, 53, "Transport / logistique"], [55, 55, "Services"], [56, 56, "Restauration"], [58, 63, "IT / Telecom"], [64, 64, "Banque"],
    [65, 65, "Assurance"], [66, 66, "Banque"], [68, 68, "BTP / Immobilier"], [69, 72, "Conseil / Ingénierie"], [73, 82, "Services"],
    [84, 84, "Public"], [85, 85, "Services"], [86, 88, "Médical / Santé"], [90, 99, "Services"],
  ];
  return ranges.find(([a, b]) => d >= a && d <= b)?.[2] ?? null;
}

const KEYWORDS: [RegExp, string][] = [
  [/pharma|biotech|laborato/, "Industrie Pharma"],
  [/aero|aviation|defense|spatial|space/, "Aéronautique"],
  [/food (and|&) beverage services|restaura|catering|hospitality/, "Restauration"],
  [/agro|food|aliment|dairy|beverage|boisson|farming|agricult/, "Agroalimentaire"],
  [/insurance|assuranc|mutuel|prevoyance/, "Assurance"],
  [/automotive|automobile/, "Automobile"],
  [/bank|banque|financ|investment/, "Banque"],
  [/construction|real estate|immobili|btp|building|architect/, "BTP / Immobilier"],
  [/chemical|chimi|plastic/, "Chimie"],
  [/retail|wholesale|commerce|distribution|negoce|consumer goods|supermarket/, "Commerce / Négoce"],
  [/consult|conseil|engineer|ingenier|accounting|legal|juridique|audit/, "Conseil / Ingénierie"],
  [/energ|oil|petrol|utilities|renewable|electric/, "Énergie"],
  [/environ|dechet|waste|recycl|water|eau/, "Environnement"],
  [/hospital|health|sante|medical|clinique|medic/, "Médical / Santé"],
  [/software|logiciel|information technology|\bit\b|telecom|internet|computer|informatique|numerique|digital/, "IT / Telecom"],
  [/luxury|luxe|cosmetic|jewel|fashion|apparel/, "Luxe"],
  [/government|public|administration|collectivite|military/, "Public"],
  [/logisti|transport|shipping|airline|maritime|freight/, "Transport / logistique"],
  [/manufactur|industr|machinery|mechanical|metal|textile|semiconductor|electronic/, "Industrie"],
  [/service|staffing|facility|proprete|security|interim|education|formation/, "Services"],
];

export function sectorFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const t = stripAccents(label.toLowerCase()).replace(/_/g, " ").trim();
  const exact = SECTEURS.find((s) => stripAccents(s.toLowerCase()) === t);
  return exact ?? KEYWORDS.find(([re]) => re.test(t))?.[1] ?? null;
}
