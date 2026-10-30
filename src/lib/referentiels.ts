// Référentiels repris du prototype (vigie-rh-prototype.html).

export const THEMES: Record<string, string[]> = {
  "Changements chez le compte": ["Dirigeants et gouvernance", "Fusion, acquisition, cession", "Organisation et effectifs", "Sites et implantations", "International", "Stratégie et résultats", "Investissements", "Outils et projets RH", "Marque et identité"],
  "RH et talents": ["Croissance et recrutement", "Recrutement", "Formation et compétences", "Marque employeur et labels", "Conditions de travail et QVT", "Dialogue social"],
  "Occasions de rencontre": ["Événements et salons"],
  "RSE et engagement": ["RSE et engagement"],
  Autres: ["Partenariats", "Communication commerciale", "Contrats et réalisations", "Expertise", "Vie interne", "Autre"],
};

export const FONCTIONS: Record<string, string[]> = {
  "Ressources humaines": ["DRH", "Responsable RH"],
  DSI: ["DSI"],
  SIRH: ["Directeur SIRH", "Responsable SIRH", "Chef de projet SIRH", "Chargé SIRH"],
  Paie: ["Directeur paie", "Responsable paie", "Chef de projet paie", "Gestionnaire de paie"],
  GTA: ["Responsable GTA", "Chef de projet GTA", "Gestionnaire GTA"],
  "Transformation digitale": ["Transformation digitale"],
  "Formation et talents": ["Directeur formation", "Responsable formation", "Responsable talents", "Chargé de formation"],
};

export const OUTILS: Record<string, string[]> = {
  "Moteur de paie": ["ADP", "Cegid Paie", "HR Access", "SAP HCM", "Silae", "Talentia", "Sage Paie", "PayFit", "Pléiades", "Nibelis"],
  "SIRH / Core HR": ["Workday", "SAP SuccessFactors", "Oracle HCM", "Lucca", "PeopleSpheres", "Eurécia"],
  GTA: ["Horoquartz", "Chronotime", "Octime", "Kelio", "UKG Pro WFM"],
  "Gestion des talents": ["Cornerstone", "Talentsoft - Cegid HR", "365Talents", "360Learning", "Digital Recruiters"],
};

export const MY_PRODUCT = "PeopleSpheres";
export const RIVALS = new Set(["Workday", "SAP SuccessFactors", "Oracle HCM", "Cegid Paie", "Talentsoft - Cegid HR", "Cornerstone", "Talentia", "Lucca", "Eurécia"]);

export const SECTEURS = ["Aéronautique", "Agroalimentaire", "Assurance", "Automobile", "Banque", "BTP / Immobilier", "Chimie", "Commerce / Négoce", "Conseil / Ingénierie", "Énergie", "Environnement", "Industrie", "Industrie Pharma", "IT / Telecom", "Luxe", "Médical / Santé", "Public", "Restauration", "Services", "Transport / logistique"];

export const TRANCHES: [number, number][] = [[250, 499], [500, 999], [1000, 1999], [2000, 4999], [5000, 9999], [10000, 19999], [20000, 49999], [50000, 1e9]];

export const STRUCTURES: Record<string, string> = { indep: "Indépendante", mere: "Maison mère", filiale: "Filiale", reseau: "Membre d'un réseau" };

export const SIGNAL_TYPES = {
  ent: { l: "Actualité entreprise", c: "p-ent" },
  dec: { l: "Actualité décideur", c: "p-dec" },
  job: { l: "Offre d'emploi", c: "p-job" },
  arr: { l: "Arrivée", c: "p-arr" },
  dep: { l: "Départ", c: "p-dep" },
} as const;
export type SignalType = keyof typeof SIGNAL_TYPES;

export const ALL_THEMES = Object.values(THEMES).flat();
export const ALL_FONCTIONS = Object.values(FONCTIONS).flat();
export const ALL_OUTILS = Object.values(OUTILS).flat();

export const fnFamily = (f: string | null | undefined) =>
  f ? Object.keys(FONCTIONS).find((k) => FONCTIONS[k].includes(f)) ?? null : null;
export const toolCategory = (t: string) => Object.keys(OUTILS).find((k) => OUTILS[k].includes(t)) ?? null;

// Thèmes et familles jugés « à fort intérêt » pour le score
export const HOT_THEMES = new Set(["Outils et projets RH", "Fusion, acquisition, cession", "Organisation et effectifs", "Dirigeants et gouvernance", "Croissance et recrutement", "International"]);
export const HOT_FAM = new Set(["SIRH", "Paie", "Ressources humaines", "GTA"]);

const fmt = (n: number) => n.toLocaleString("fr-FR");
export const trancheLabel = (t: [number, number]) => (t[1] >= 1e9 ? `${fmt(t[0])} et plus` : `${fmt(t[0])} à ${fmt(t[1])}`);
