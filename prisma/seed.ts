// Données de DÉMONSTRATION, entièrement fictives et marquées isDemo = true.
// Supprimables à tout moment : `npm run db:purge-demo`.
import { PrismaClient } from "@prisma/client";
import { computeScore } from "../src/lib/score";
import { fnFamily, toolCategory } from "../src/lib/referentiels";
import { nameKey } from "../src/lib/normalize";

const prisma = new PrismaClient();
const DAY = 864e5;
const ago = (d: number) => new Date(Date.now() - d * DAY);

type Demo = {
  name: string; sector: string; activity: string; headcount: number; groupHeadcount: number;
  structure: string; subsidiariesCount?: number; isPublic?: boolean; foreignGroup?: boolean; city: string;
  tools: [string, number][];
  contacts: [string, string, number][]; // nom, fonction, en poste depuis (jours)
  signals: { type: string; theme?: string; function?: string; person?: string; summary: string; days: number }[];
};

const DEMOS: Demo[] = [
  {
    name: "[DÉMO] Alvéa Industries", sector: "Industrie", activity: "Fabrication d'équipements", headcount: 1850, groupHeadcount: 3200,
    structure: "mere", subsidiariesCount: 6, city: "Lyon",
    tools: [["Cegid Paie", 4], ["Horoquartz", 3], ["Cornerstone", 2]],
    contacts: [["Claire Mercier", "DRH", 900], ["Julien Fabre", "Responsable SIRH", 120], ["Sophie Lemoine", "Responsable paie", 1500]],
    signals: [
      { type: "ent", theme: "Outils et projets RH", summary: "Appel d'offres pour remplacer le SIRH et unifier la paie des filiales (exemple fictif).", days: 3 },
      { type: "job", function: "Chef de projet SIRH", summary: "Chef de projet SIRH (F/H) — CDI, Lyon (exemple fictif)", days: 6 },
      { type: "arr", function: "Responsable SIRH", person: "Julien Fabre", summary: "Julien Fabre rejoint l'entreprise comme Responsable SIRH (exemple fictif)", days: 20 },
      { type: "ent", theme: "Fusion, acquisition, cession", summary: "Acquisition d'un concurrent régional de 600 salariés (exemple fictif).", days: 45 },
    ],
  },
  {
    name: "[DÉMO] Brennac Logistique", sector: "Transport / logistique", activity: "Transport et entreposage", headcount: 4200, groupHeadcount: 4200,
    structure: "indep", city: "Nantes",
    tools: [["ADP", 5], ["Kelio", 3]],
    contacts: [["Thomas Garnier", "DRH", 2000], ["Camille Roux", "Gestionnaire GTA", 400]],
    signals: [
      { type: "ent", theme: "Croissance et recrutement", summary: "300 recrutements prévus d'ici fin 2027 (exemple fictif).", days: 10 },
      { type: "job", function: "Gestionnaire de paie", summary: "Gestionnaire de paie (F/H) — CDI, Nantes (exemple fictif)", days: 15 },
      { type: "dep", function: "Responsable paie", person: "Nicolas Chevalier", summary: "Nicolas Chevalier quitte son poste de Responsable paie (exemple fictif)", days: 30 },
    ],
  },
  {
    name: "[DÉMO] Mutuelle Corvalis", sector: "Assurance", activity: "Mutuelle santé et prévoyance", headcount: 780, groupHeadcount: 1300,
    structure: "reseau", city: "Lille",
    tools: [["Talentia", 4], ["Lucca", 2]],
    contacts: [["Élodie Barbier", "Responsable RH", 700], ["Marc Perrin", "DSI", 1100]],
    signals: [
      { type: "dec", theme: "Dirigeants et gouvernance", person: "Laure Morel", summary: "Laure Morel · Nomination d'une nouvelle directrice générale (exemple fictif).", days: 12 },
      { type: "ent", theme: "Événements et salons", summary: "Présente au salon Solutions RH (exemple fictif).", days: 60 },
    ],
  },
  {
    name: "[DÉMO] Département de Valbreuse", sector: "Public", activity: "Collectivité territoriale", headcount: 5600, groupHeadcount: 5600,
    structure: "indep", isPublic: true, city: "Dijon",
    tools: [["HR Access", 4]],
    contacts: [["Antoine Colin", "DRH", 3000], ["Inès Gauthier", "Chef de projet paie", 200]],
    signals: [
      { type: "job", function: "Chef de projet SIRH", summary: "Chef de projet SIRH (F/H) — Titulaire ou contractuel (exemple fictif)", days: 8 },
      { type: "ent", theme: "Organisation et effectifs", summary: "Réorganisation des fonctions support en centre de services partagés (exemple fictif).", days: 70 },
    ],
  },
  {
    name: "[DÉMO] Hélior Pharma", sector: "Industrie Pharma", activity: "Laboratoire pharmaceutique", headcount: 2400, groupHeadcount: 26000,
    structure: "filiale", foreignGroup: true, city: "Rouen",
    tools: [["Workday", 3], ["SAP HCM", 2], ["360Learning", 2]],
    contacts: [["Romain Renard", "Directeur SIRH", 500], ["Aurélie Picard", "Responsable formation", 900]],
    signals: [
      { type: "ent", theme: "International", summary: "Implantation en Espagne et en Italie (exemple fictif).", days: 25 },
      { type: "job", function: "Responsable formation", summary: "Responsable formation (F/H) — CDI, Rouen (exemple fictif)", days: 120 },
    ],
  },
  {
    name: "[DÉMO] Givrac Restauration", sector: "Restauration", activity: "Restauration collective", headcount: 380, groupHeadcount: 380,
    structure: "indep", city: "Bordeaux",
    tools: [["Silae", 3]],
    contacts: [["Hugo Brunet", "Responsable RH", 600]],
    signals: [{ type: "ent", theme: "RSE et engagement", summary: "Publication du rapport RSE (exemple fictif).", days: 150 }],
  },
];

async function main() {
  await prisma.company.deleteMany({ where: { isDemo: true } });
  for (const d of DEMOS) {
    const c = await prisma.company.create({
      data: {
        name: d.name, nameKey: nameKey(d.name), sector: d.sector, activity: d.activity, headcount: d.headcount,
        headcountSource: "demo", groupHeadcount: d.groupHeadcount, structure: d.structure, subsidiariesCount: d.subsidiariesCount ?? 0,
        isPublic: !!d.isPublic, foreignGroup: !!d.foreignGroup, city: d.city, isDemo: true,
        contacts: {
          create: d.contacts.map(([fullName, fn, since]) => ({
            fullName, rawTitle: fn, function: fn, functionFamily: fnFamily(fn), since: ago(since), source: "demo", isDemo: true,
            email: `${fullName.split(" ")[0][0].toLowerCase()}.${fullName.split(" ")[1].toLowerCase()}@exemple.invalid`,
          })),
        },
        signals: {
          create: d.signals.map((s, i) => ({
            type: s.type, theme: s.theme ?? null, function: s.function ?? null, functionFamily: fnFamily(s.function),
            person: s.person ?? null, summary: s.summary, url: `https://exemple.invalid/demo/${i}`, date: ago(s.days), source: "demo", isDemo: true,
          })),
        },
        tools: {
          create: d.tools.map(([tool, confidence]) => ({ tool, category: toolCategory(tool) ?? "Autre", confidence, source: "demo" })),
        },
      },
    });
    const score = computeScore({
      headcount: d.headcount, groupHeadcount: d.groupHeadcount, tools: d.tools.map((t) => t[0]),
      signals: d.signals.map((s) => ({ type: s.type, theme: s.theme ?? null, function: s.function ?? null, date: ago(s.days) })),
    });
    await prisma.company.update({
      where: { id: c.id },
      data: { scoreTotal: score.total, scoreParts: JSON.stringify(score.parts), lastSignalAt: score.last, signalCount: score.count },
    });
  }
  console.log(`Seed : ${DEMOS.length} entreprises de démo créées.`);
}

main().finally(() => prisma.$disconnect());
