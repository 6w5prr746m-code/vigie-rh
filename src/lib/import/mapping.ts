// Champs attendus par type d'import et reconnaissance automatique des en-têtes
// (exports HubSpot en français et en anglais, fichiers maison).
import { stripAccents } from "../normalize";

export type ImportKind = "entreprises" | "contacts" | "exclusions";
export type Field = { key: string; label: string; synonyms: string[]; required?: boolean };
export type Mapping = Record<string, string | null>;

export const FIELDS: Record<ImportKind, Field[]> = {
  entreprises: [
    { key: "name", label: "Nom de l'entreprise", required: true, synonyms: ["nom de l entreprise", "company name", "raison sociale", "denomination", "nom", "name", "entreprise", "societe", "compte", "account name"] },
    { key: "siren", label: "SIREN (ou SIRET)", synonyms: ["siren", "numero siren", "n siren", "siret", "numero siret", "siren siret"] },
    { key: "hubspotId", label: "ID HubSpot (Record ID)", synonyms: ["record id", "id de fiche", "id de fiche d informations", "company id", "id de l entreprise", "hubspot id", "id"] },
    { key: "domain", label: "Domaine / site web", synonyms: ["company domain name", "nom de domaine de l entreprise", "domaine", "domain", "website url", "url du site web", "site web", "website"] },
    { key: "headcount", label: "Effectif de l'entité", synonyms: ["number of employees", "nombre d employes", "nombre de salaries", "effectif", "effectif entite", "salaries", "employees"] },
    { key: "groupHeadcount", label: "Effectif du groupe", synonyms: ["effectif groupe", "effectif du groupe", "group headcount", "group employees"] },
    { key: "sector", label: "Secteur", synonyms: ["secteur d activite", "industry", "secteur", "industrie"] },
    { key: "nafCode", label: "Code NAF / APE", synonyms: ["code naf", "naf", "code ape", "ape", "activite principale"] },
    { key: "city", label: "Ville", synonyms: ["ville", "city", "commune"] },
    { key: "structure", label: "Structure (mère / filiale / réseau)", synonyms: ["structure", "type de structure"] },
    { key: "parent", label: "Maison mère (nom)", synonyms: ["parent company", "entreprise parente", "entreprise parent", "maison mere", "groupe", "societe mere"] },
    { key: "lifecycle", label: "Phase du cycle de vie", synonyms: ["phase du cycle de vie", "lifecycle stage", "etape du cycle de vie", "cycle de vie"] },
    { key: "customer", label: "Client (oui / non) ou type", synonyms: ["client", "customer", "est client", "client signe", "type", "type d entreprise", "company type"] },
    { key: "foreignGroup", label: "Groupe étranger (oui / non)", synonyms: ["groupe etranger", "foreign group", "groupe international"] },
    { key: "isPublic", label: "Public (oui / non)", synonyms: ["public", "secteur public", "public prive"] },
  ],
  contacts: [
    { key: "firstName", label: "Prénom", synonyms: ["prenom", "first name", "firstname"] },
    { key: "lastName", label: "Nom", synonyms: ["nom", "last name", "lastname", "nom de famille"] },
    { key: "fullName", label: "Nom complet (si pas de prénom / nom)", synonyms: ["nom complet", "full name", "contact", "nom et prenom", "prenom nom", "name"] },
    { key: "title", label: "Intitulé du poste", synonyms: ["intitule du poste", "job title", "fonction", "poste", "titre", "title"] },
    { key: "email", label: "E-mail", synonyms: ["e mail", "email", "adresse e mail", "courriel", "email address"] },
    { key: "companyName", label: "Entreprise (nom)", synonyms: ["entreprise associee principale", "primary associated company", "nom de l entreprise", "company name", "associated company", "entreprise associee", "entreprise", "societe", "company"] },
    { key: "companyHubspotId", label: "ID HubSpot de l'entreprise", synonyms: ["associated company ids", "id d entreprise associee", "ids d entreprise associee", "associated company id", "primary associated company id", "id de l entreprise associee principale", "company id"] },
    { key: "siren", label: "SIREN de l'entreprise", synonyms: ["siren", "siret", "numero siren"] },
    { key: "hubspotId", label: "ID HubSpot du contact (Record ID)", synonyms: ["record id", "id de fiche", "contact id", "hubspot id", "id"] },
    { key: "since", label: "En poste depuis", synonyms: ["en poste depuis", "date de prise de poste", "start date", "date d arrivee", "since"] },
  ],
  exclusions: [
    { key: "siren", label: "SIREN (ou SIRET)", synonyms: ["siren", "siret", "numero siren", "numero siret"] },
    { key: "name", label: "Nom de l'entreprise", synonyms: ["nom de l entreprise", "company name", "raison sociale", "nom", "name", "entreprise", "client", "societe"] },
  ],
};

export const normHeader = (h: string) => stripAccents(h.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();

export function autoMap(headers: string[], kind: ImportKind): Mapping {
  const used = new Set<string>();
  const norm = headers.map((h) => [h, normHeader(h)] as const);
  const mapping: Mapping = {};
  // 1er passage : correspondance exacte, par ordre de priorité des synonymes
  for (const f of FIELDS[kind]) {
    const hit = f.synonyms.map((s) => norm.find(([h, n]) => n === s && !used.has(h))).find(Boolean);
    mapping[f.key] = hit ? hit[0] : null;
    if (hit) used.add(hit[0]);
  }
  // 2e passage : l'en-tête contient un synonyme assez long
  for (const f of FIELDS[kind]) {
    if (mapping[f.key]) continue;
    const hit = norm.find(([h, n]) => !used.has(h) && f.synonyms.some((s) => s.length >= 6 && n.includes(s)));
    if (hit) { mapping[f.key] = hit[0]; used.add(hit[0]); }
  }
  return mapping;
}

/** Message d'erreur si un champ indispensable n'est pas associé. */
export function mappingError(kind: ImportKind, m: Mapping): string | null {
  if (kind === "entreprises" && !m.name && !m.siren) return "Associez au moins la colonne du nom ou du SIREN.";
  if (kind === "contacts" && !m.fullName && !m.lastName) return "Associez la colonne du nom (ou du nom complet).";
  if (kind === "contacts" && !m.companyName && !m.companyHubspotId && !m.siren) return "Associez une colonne permettant de retrouver l'entreprise (nom, ID HubSpot ou SIREN).";
  if (kind === "exclusions" && !m.siren && !m.name) return "Associez la colonne du SIREN ou du nom.";
  return null;
}

// ----- Lecture des valeurs -----
export const parseSiren = (v: string | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(0, 9) : null;
};
export const parseIntLoose = (v: string | undefined) => {
  const m = (v ?? "").replace(/[\s  ]/g, "").replace(/[.,](?=\d{3}\b)/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
};
export const parseBool = (v: string | undefined) => {
  const t = stripAccents((v ?? "").toLowerCase().trim());
  if (!t) return null;
  if (["oui", "yes", "true", "vrai", "1", "x", "o", "y"].includes(t)) return true;
  if (["non", "no", "false", "faux", "0", "n"].includes(t)) return false;
  return null;
};
export function parseDateLoose(v: string | undefined): Date | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1));
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Number(m[2]), Number(m[1]) - 1, 1);
  m = t.match(/^(\d{4})$/);
  if (m) return new Date(Number(m[1]), 0, 1);
  return null;
}
const CUSTOMER_VALUES = new Set(["customer", "client", "clients", "client signe", "client actif", "oui", "yes", "true", "1", "x"]);
export const isCustomerValue = (v: string | undefined) => CUSTOMER_VALUES.has(stripAccents((v ?? "").toLowerCase().trim()));
