// Client de l'API Recherche d'entreprises (https://recherche-entreprises.api.gouv.fr, sans clé).
// Limites publiques : 25 résultats par page, ~7 requêtes / seconde, 10 000 résultats par requête.
import { sectorFromNaf } from "../sectors";

const BASE = "https://recherche-entreprises.api.gouv.fr/search";

/** Codes INSEE de tranche d'effectif salarié et borne basse correspondante. */
export const TRANCHES_INSEE: Record<string, number> = { "32": 250, "41": 500, "42": 1000, "51": 2000, "52": 5000, "53": 10000 };
export const trancheCodesFrom = (min: number) => Object.entries(TRANCHES_INSEE).filter(([, v]) => v >= min).map(([k]) => k);

/** Sections NAF (A à U). O = administration publique. */
export const SECTIONS = "ABCDEFGHIJKLMNOPQRSTU".split("");

export type ApiCompany = {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string | null;
  sigle?: string | null;
  activite_principale?: string | null;
  section_activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  categorie_entreprise?: string | null;
  nature_juridique?: string | null;
  etat_administratif?: string | null;
  nombre_etablissements_ouverts?: number | null;
  siege?: { libelle_commune?: string | null; commune?: string | null; code_postal?: string | null; departement?: string | null } | null;
  complements?: { est_service_public?: boolean | null; collectivite_territoriale?: unknown } | null;
};
export type ApiPage = { results: ApiCompany[]; total_results: number; page: number; per_page: number; total_pages: number };

/** Personne morale de droit public (catégories juridiques 4xxx et 7xxx) ou service public déclaré. */
export const isPublicEntity = (c: ApiCompany) =>
  /^[47]/.test(c.nature_juridique ?? "") || !!c.complements?.est_service_public || !!c.complements?.collectivite_territoriale || c.section_activite_principale === "O";

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** Fiche API → champs Company. */
export function toCompany(c: ApiCompany) {
  const raw = c.nom_raison_sociale || c.nom_complet || c.siren;
  const tranche = c.tranche_effectif_salarie ?? null;
  return {
    siren: c.siren,
    name: titleCase(raw),
    nafCode: c.activite_principale ?? null,
    sector: sectorFromNaf(c.activite_principale),
    headcountRange: tranche,
    headcount: tranche && TRANCHES_INSEE[tranche] != null ? TRANCHES_INSEE[tranche] : null,
    city: c.siege?.libelle_commune ? titleCase(c.siege.libelle_commune) : null,
    isPublic: isPublicEntity(c),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;

/** Appel throttlé (≤ 6 req/s) avec reprise sur 429 / 5xx. */
export async function apiSearch(params: Record<string, string | number>, fetchImpl: typeof fetch = fetch): Promise<ApiPage> {
  const url = `${BASE}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = last + 170 - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (attempt < 2) { await sleep(1000 * 2 ** attempt); continue; }
      throw new Error(`Recherche d'entreprises injoignable (${(e as Error).message}). Vérifiez votre connexion.`);
    }
    if (res.ok) return (await res.json()) as ApiPage;
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    throw new Error(`Recherche d'entreprises : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error("Recherche d'entreprises : trop de tentatives (limite de débit)");
}

export type UniverseCriteria = { minHeadcount: number; includePublic: boolean };

export function universeParams(c: UniverseCriteria, section: string) {
  return { tranche_effectif_salarie: trancheCodesFrom(c.minHeadcount).join(","), etat_administratif: "A", section_activite_principale: section };
}

export const universeSections = (c: UniverseCriteria) => SECTIONS.filter((s) => c.includePublic || s !== "O");

/** Nombre d'entreprises par section NAF pour les critères donnés. */
export async function estimateUniverse(c: UniverseCriteria, fetchImpl?: typeof fetch) {
  const out: Record<string, number> = {};
  for (const s of universeSections(c)) out[s] = (await apiSearch({ ...universeParams(c, s), per_page: 1, page: 1 }, fetchImpl)).total_results;
  return out;
}
