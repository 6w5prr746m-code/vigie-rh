// Liste d'exclusion (clients signés) : règles par SIREN ou par nom normalisé.
import { prisma } from "./db";
import { nameKey } from "./normalize";

export async function addExclusionRule(input: { siren?: string | null; name?: string | null }) {
  const siren = input.siren || null;
  const key = input.name ? nameKey(input.name) : null;
  if (!siren && !key) return null;
  const label = input.name?.trim() || siren!;
  if (siren) return prisma.exclusionRule.upsert({ where: { siren }, create: { siren, nameKey: key, label }, update: { label, nameKey: key ?? undefined } });
  const existing = await prisma.exclusionRule.findFirst({ where: { nameKey: key, siren: null } });
  return existing ?? prisma.exclusionRule.create({ data: { nameKey: key, label } });
}

/** Marque client et exclut les entreprises qui correspondent à une règle. Renvoie les ids touchés. */
export async function applyExclusionRules(companyIds?: string[]): Promise<string[]> {
  const rules = await prisma.exclusionRule.findMany();
  if (!rules.length) return [];
  const sirens = rules.map((r) => r.siren).filter((s): s is string => !!s);
  const keys = rules.map((r) => r.nameKey).filter((k): k is string => !!k);
  const matches = await prisma.company.findMany({
    where: {
      ...(companyIds ? { id: { in: companyIds } } : {}),
      OR: [{ siren: { in: sirens } }, { nameKey: { in: keys } }],
      excluded: { is: null },
    },
    select: { id: true },
  });
  for (const { id } of matches) {
    await prisma.company.update({ where: { id }, data: { isCustomer: true } });
    await prisma.excluded.upsert({ where: { companyId: id }, create: { companyId: id, reason: "client" }, update: { reason: "client" } });
  }
  return matches.map((m) => m.id);
}
