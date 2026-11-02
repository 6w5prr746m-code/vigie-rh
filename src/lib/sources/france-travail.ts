// Client de l'API France Travail « Offres d'emploi v2 » (francetravail.io).
// Authentification OAuth2 client_credentials ; 150 offres max par appel, 3 150 par recherche.

const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

export type FtOffer = {
  id: string;
  intitule: string;
  description?: string;
  dateCreation: string;
  lieuTravail?: { libelle?: string; commune?: string };
  entreprise?: { nom?: string; description?: string; url?: string };
  typeContrat?: string;
  typeContratLibelle?: string;
  origineOffre?: { urlOrigine?: string };
  secteurActiviteLibelle?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FranceTravailClient {
  private token: { value: string; exp: number } | null = null;
  private last = 0;
  constructor(private clientId: string, private clientSecret: string, private fetchImpl: typeof fetch = fetch) {}

  static fromEnv(fetchImpl?: typeof fetch) {
    const id = process.env.FRANCE_TRAVAIL_CLIENT_ID, secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
    if (!id || !secret) throw new Error("FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET doivent être renseignés dans .env");
    return new FranceTravailClient(id, secret, fetchImpl);
  }

  private async getToken() {
    if (this.token && this.token.exp > Date.now() + 30_000) return this.token.value;
    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.clientId, client_secret: this.clientSecret, scope: SCOPE }),
    });
    if (!res.ok) throw new Error(`France Travail : authentification refusée (HTTP ${res.status}). Vérifiez l'identifiant, le secret et que l'API « Offres d'emploi v2 » est bien ajoutée à votre application.`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
    return this.token.value;
  }

  /** Une page de résultats. `range` au format « 0-149 ». Renvoie aussi le total annoncé (Content-Range). */
  async searchPage(params: Record<string, string>, range: string): Promise<{ offers: FtOffer[]; total: number }> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const wait = this.last + 120 - Date.now(); // ~8 req/s, sous la limite de l'API
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      const res = await this.fetchImpl(`${SEARCH_URL}?${new URLSearchParams({ ...params, range })}`, {
        headers: { Authorization: `Bearer ${await this.getToken()}`, Accept: "application/json" },
      });
      if (res.status === 204) return { offers: [], total: 0 };
      if (res.ok) {
        const json = (await res.json()) as { resultats?: FtOffer[] };
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? json.resultats?.length ?? 0);
        return { offers: json.resultats ?? [], total };
      }
      if (res.status === 401) { this.token = null; continue; }
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
      throw new Error(`France Travail : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    throw new Error("France Travail : trop de tentatives (limite de débit)");
  }

  /** Toutes les offres d'une recherche, page par page (plafond API : 3 150). */
  async *search(params: Record<string, string>): AsyncGenerator<FtOffer> {
    for (let start = 0; start < 3150; start += 150) {
      const { offers, total } = await this.searchPage(params, `${start}-${Math.min(start + 149, 3149)}`);
      yield* offers;
      if (offers.length < 150 || start + 150 >= total) break;
    }
  }
}

export const offerUrl = (o: FtOffer) => `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`;

/** Offres publiées par un cabinet ou une agence pour le compte d'un client : l'employeur réel n'est pas l'annonceur. */
export const isIntermediary = (o: FtOffer) =>
  /pour (?:le compte (?:d'|de )|l'une? de )?(?:notre|nos) client(?:e)?s?\b|cabinet de recrutement|agence d'emploi|agence d'int[ée]rim|mission d'int[ée]rim/i.test(`${o.description ?? ""} ${o.entreprise?.description ?? ""}`);
