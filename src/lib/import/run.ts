// Import des lignes d'un fichier (entreprises, contacts, liste d'exclusion) dans la base.
// Ré-importable : rapprochement par ID HubSpot, SIREN, puis nom normalisé (ou e-mail pour les contacts).
import { prisma } from "../db";
import { CompanyIndex } from "../company-index";
import { nameKey } from "../normalize";
import { STRUCTURES } from "../referentiels";
import { sectorFromLabel, sectorFromNaf } from "../sectors";
import { normalizeTitle } from "../titles";
import { recomputeScores } from "../scoring";
import { addExclusionRule, applyExclusionRules } from "../exclusions";
import { isCustomerValue, parseBool, parseDateLoose, parseIntLoose, parseSiren, type ImportKind, type Mapping } from "./mapping";

export type ImportReport = {
  kind: ImportKind;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  createdCompanies: number;
  customers: number;
  signals: number;
  pendingExclusions: number;
  issues: { row: number; message: string }[];
};

type Row = Record<string, string>;
const val = (r: Row, m: Mapping, k: string) => (m[k] ? (r[m[k]!] ?? "").trim() : "");

const STRUCT_WORDS: [RegExp, string][] = [[/mere|holding|groupe|parent/, "mere"], [/filiale|subsidiary/, "filiale"], [/reseau|franchise|network|cooperative/, "reseau"], [/indep|independ/, "indep"]];
const parseStructure = (v: string) => {
  if (!v) return null;
  if (v in STRUCTURES) return v;
  const t = nameKey(v);
  return STRUCT_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
};

const cleanDomain = (v: string) => v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || null;

export async function runImport(kind: ImportKind, rows: Row[], m: Mapping, opts: { createMissingCompanies?: boolean; fileName?: string } = {}): Promise<ImportReport> {
  const report: ImportReport = { kind, rows: rows.length, created: 0, updated: 0, skipped: 0, createdCompanies: 0, customers: 0, signals: 0, pendingExclusions: 0, issues: [] };
  const touched = new Set<string>();
  const issue = (i: number, message: string) => { if (report.issues.length < 500) report.issues.push({ row: i + 2, message }); };

  if (kind === "exclusions") {
    for (const [i, r] of rows.entries()) {
      const siren = parseSiren(val(r, m, "siren"));
      const name = val(r, m, "name");
      if (!siren && !name) { report.skipped++; issue(i, "Ni SIREN ni nom"); continue; }
      await addExclusionRule({ siren, name });
      report.created++;
    }
    const hit = await applyExclusionRules();
    report.customers = hit.length;
    report.pendingExclusions = Math.max(0, report.created - hit.length);
  }

  if (kind === "entreprises") {
    const idx = await CompanyIndex.load();
    const parents: { id: string; parent: string }[] = [];
    for (const [i, r] of rows.entries()) {
      const name = val(r, m, "name");
      const siren = parseSiren(val(r, m, "siren"));
      const hubspotId = val(r, m, "hubspotId") || null;
      const domain = cleanDomain(val(r, m, "domain"));
      if (!name && !siren) { report.skipped++; issue(i, "Ligne sans nom ni SIREN"); continue; }
      const found = idx.find({ hubspotId, siren, name, domain });
      if (found.ambiguous) { report.skipped++; issue(i, `« ${name} » correspond à plusieurs entreprises : ajoutez le SIREN`); continue; }

      const nafCode = val(r, m, "nafCode") || null;
      const sectorRaw = val(r, m, "sector");
      const headcount = parseIntLoose(val(r, m, "headcount"));
      const data: Record<string, unknown> = {};
      if (name) { data.name = name; data.nameKey = nameKey(name); }
      if (siren) data.siren = siren;
      if (hubspotId) data.hubspotId = hubspotId;
      if (domain) data.domain = domain;
      if (headcount != null) { data.headcount = headcount; data.headcountSource = "csv"; }
      const gh = parseIntLoose(val(r, m, "groupHeadcount"));
      if (gh != null) data.groupHeadcount = gh;
      if (nafCode) data.nafCode = nafCode;
      const sector = sectorFromLabel(sectorRaw) ?? sectorFromNaf(nafCode);
      if (sector) data.sector = sector;
      if (sectorRaw && !sector) issue(i, `Secteur « ${sectorRaw} » non reconnu (laissé vide)`);
      const city = val(r, m, "city");
      if (city) data.city = city;
      const structure = parseStructure(val(r, m, "structure"));
      if (structure) data.structure = structure;
      const fg = parseBool(val(r, m, "foreignGroup"));
      if (fg != null) data.foreignGroup = fg;
      const pub = parseBool(val(r, m, "isPublic"));
      if (pub != null) data.isPublic = pub;
      else if (sector === "Public") data.isPublic = true;

      // Client signé : phase du cycle de vie « Client / Customer » ou colonne Client = oui
      const lc = val(r, m, "lifecycle"), cu = val(r, m, "customer");
      const customerKnown = !!(lc || cu);
      const isCustomer = isCustomerValue(lc) || isCustomerValue(cu);

      let id = found.id;
      let wasCustomer = false;
      try {
        if (id) {
          wasCustomer = !!(await prisma.company.findUnique({ where: { id }, select: { isCustomer: true } }))?.isCustomer;
          await prisma.company.update({ where: { id }, data: { ...data, ...(customerKnown ? { isCustomer } : {}) } });
          report.updated++;
        } else {
          const c = await prisma.company.create({
            data: { ...(data as { name: string; nameKey: string }), name: name || siren!, nameKey: nameKey(name || siren!), isCustomer: customerKnown && isCustomer },
          });
          id = c.id;
          report.created++;
        }
      } catch (e) {
        report.skipped++;
        issue(i, `Erreur d'enregistrement : ${(e as Error).message.split("\n").pop()}`);
        continue;
      }
      idx.add({ id, name: (data.name as string) ?? idx.names.get(id) ?? name, hubspotId, siren, nameKey: (data.nameKey as string) ?? nameKey(name), domain });
      touched.add(id);
      if (customerKnown && isCustomer && !wasCustomer) {
        await prisma.excluded.upsert({ where: { companyId: id }, create: { companyId: id, reason: "client" }, update: { reason: "client" } });
        report.customers++;
      } else if (customerKnown && !isCustomer && wasCustomer) {
        await prisma.excluded.deleteMany({ where: { companyId: id, reason: "client" } });
      }
      const parent = val(r, m, "parent");
      if (parent) parents.push({ id, parent });
    }
    // Liens maison mère → filiale, une fois toutes les lignes connues
    for (const p of parents) {
      const parentId = idx.find({ name: p.parent }).id;
      if (parentId && parentId !== p.id) {
        await prisma.company.update({ where: { id: p.id }, data: { parentId, structure: "filiale" } });
        await prisma.company.update({ where: { id: parentId }, data: { structure: "mere" } });
      }
    }
    const parentIds = [...new Set(parents.map((p) => idx.find({ name: p.parent }).id).filter((x): x is string => !!x))];
    for (const pid of parentIds) {
      await prisma.company.update({ where: { id: pid }, data: { subsidiariesCount: await prisma.company.count({ where: { parentId: pid } }) } });
    }
    report.customers += (await applyExclusionRules([...touched])).length;
  }

  if (kind === "contacts") {
    const idx = await CompanyIndex.load();
    const existing = await prisma.contact.findMany({ select: { id: true, hubspotId: true, email: true, fullName: true, companyId: true, function: true, rawTitle: true } });
    const byHubspot = new Map(existing.filter((c) => c.hubspotId).map((c) => [c.hubspotId!, c]));
    const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
    const byName = new Map(existing.map((c) => [`${nameKey(c.fullName)}|${c.companyId}`, c]));
    const now = new Date();

    const addSignal = async (companyId: string, contactId: string, type: "arr" | "dep", fn: string | null, person: string, summary: string) => {
      const externalId = `import:${contactId}:${type}:${companyId}:${fn ?? ""}`;
      const { functionFamily } = normalizeTitle(fn);
      if (await prisma.signal.findUnique({ where: { externalId }, select: { id: true } })) return; // déjà détecté
      await prisma.signal.create({ data: { companyId, type, function: fn, functionFamily, person, summary, date: now, source: "import", externalId } });
      report.signals++;
      touched.add(companyId);
    };

    for (const [i, r] of rows.entries()) {
      const first = val(r, m, "firstName"), last = val(r, m, "lastName");
      const fullName = val(r, m, "fullName") || [first, last].filter(Boolean).join(" ");
      if (!fullName) { report.skipped++; issue(i, "Contact sans nom"); continue; }
      const companyName = val(r, m, "companyName");
      const companyHubspotId = val(r, m, "companyHubspotId").split(/[;,]/)[0]?.trim() || null;
      const siren = parseSiren(val(r, m, "siren"));
      const found = idx.find({ hubspotId: companyHubspotId, siren, name: companyName });
      let companyId = found.id;
      if (!companyId && found.ambiguous) { report.skipped++; issue(i, `${fullName} : « ${companyName} » correspond à plusieurs entreprises`); continue; }
      if (!companyId) {
        if (!opts.createMissingCompanies || !(companyName || siren)) { report.skipped++; issue(i, `${fullName} : entreprise introuvable${companyName ? ` (« ${companyName} »)` : ""}`); continue; }
        const c = await prisma.company.create({ data: { name: companyName || siren!, nameKey: nameKey(companyName || siren!), siren, hubspotId: companyHubspotId } });
        idx.add(c);
        companyId = c.id;
        report.createdCompanies++;
        touched.add(c.id);
      }

      const rawTitle = val(r, m, "title") || null;
      const norm = normalizeTitle(rawTitle);
      const email = val(r, m, "email").toLowerCase() || null;
      const hubspotId = val(r, m, "hubspotId") || null;
      const since = parseDateLoose(val(r, m, "since"));
      const data = {
        fullName, firstName: first || null, lastName: last || null, companyId,
        ...(rawTitle ? { rawTitle, function: norm.function, functionFamily: norm.functionFamily } : {}),
        ...(email ? { email } : {}), ...(hubspotId ? { hubspotId } : {}), ...(since ? { since } : {}),
      };
      const prev = (hubspotId && byHubspot.get(hubspotId)) || (email && byEmail.get(email)) || byName.get(`${nameKey(fullName)}|${companyId}`);
      try {
        if (prev) {
          await prisma.contact.update({ where: { id: prev.id }, data });
          report.updated++;
          const label = (fn: string | null, raw: string | null) => fn ?? raw ?? "poste non précisé";
          if (prev.companyId !== companyId) {
            await addSignal(prev.companyId, prev.id, "dep", prev.function, fullName, `${fullName} quitte son poste de ${label(prev.function, prev.rawTitle)}`);
            await addSignal(companyId, prev.id, "arr", norm.function, fullName, `${fullName} rejoint ${idx.names.get(companyId) ?? companyName} comme ${label(norm.function, rawTitle)}`);
          } else if (norm.function && prev.function !== norm.function) {
            await addSignal(companyId, prev.id, "arr", norm.function, fullName, `${fullName} prend le poste de ${norm.function}${prev.function ? ` (auparavant ${prev.function})` : ""}`);
          }
          Object.assign(prev, { companyId, function: norm.function ?? prev.function, rawTitle: rawTitle ?? prev.rawTitle });
        } else {
          const c = await prisma.contact.create({ data: { ...data, source: "csv" } });
          const entry = { id: c.id, hubspotId, email, fullName, companyId, function: c.function, rawTitle };
          if (hubspotId) byHubspot.set(hubspotId, entry);
          if (email) byEmail.set(email, entry);
          byName.set(`${nameKey(fullName)}|${companyId}`, entry);
          report.created++;
        }
      } catch (e) {
        report.skipped++;
        issue(i, `${fullName} : ${(e as Error).message.split("\n").pop()}`);
      }
    }
    report.customers += (await applyExclusionRules([...touched])).length;
  }

  if (touched.size) await recomputeScores([...touched]);
  await prisma.importRun.create({ data: { kind, fileName: opts.fileName ?? null, stats: JSON.stringify({ ...report, issues: report.issues.length }) } });
  return report;
}
