import { prisma } from "./db";

export async function excludedList() {
  const rows = await prisma.excluded.findMany({ include: { company: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.companyId, name: r.company.name }));
}

/** Ramène la page demandée dans les bornes une fois le total connu. */
export const clampPage = (page: number, per: number, total: number) => Math.min(page, Math.max(1, Math.ceil(total / per)));
