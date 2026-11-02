// Index en mémoire des entreprises (ID HubSpot, SIREN, nom normalisé, domaine) pour rapprocher vite de gros volumes.
import { prisma } from "./db";
import { nameKey } from "./normalize";

export class CompanyIndex {
  byHubspot = new Map<string, string>();
  bySiren = new Map<string, string>();
  byKey = new Map<string, string[]>();
  byDomain = new Map<string, string>();
  names = new Map<string, string>();

  static async load() {
    const idx = new CompanyIndex();
    const all = await prisma.company.findMany({ select: { id: true, name: true, hubspotId: true, siren: true, nameKey: true, domain: true } });
    all.forEach((c) => idx.add(c));
    return idx;
  }
  add(c: { id: string; name: string; hubspotId: string | null; siren: string | null; nameKey: string; domain: string | null }) {
    if (c.hubspotId) this.byHubspot.set(c.hubspotId, c.id);
    if (c.siren) this.bySiren.set(c.siren, c.id);
    if (c.domain) this.byDomain.set(c.domain, c.id);
    const ids = this.byKey.get(c.nameKey) ?? [];
    if (!ids.includes(c.id)) this.byKey.set(c.nameKey, [...ids, c.id]);
    this.names.set(c.id, c.name);
  }
  find(q: { hubspotId?: string | null; siren?: string | null; name?: string | null; domain?: string | null }): { id: string | null; ambiguous?: boolean } {
    if (q.hubspotId && this.byHubspot.has(q.hubspotId)) return { id: this.byHubspot.get(q.hubspotId)! };
    if (q.siren && this.bySiren.has(q.siren)) return { id: this.bySiren.get(q.siren)! };
    if (q.name) {
      const ids = this.byKey.get(nameKey(q.name)) ?? [];
      if (ids.length === 1) return { id: ids[0] };
      if (ids.length > 1) return { id: null, ambiguous: true };
    }
    if (q.domain && this.byDomain.has(q.domain)) return { id: this.byDomain.get(q.domain)! };
    return { id: null };
  }
}

