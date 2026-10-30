"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeTitle } from "@/lib/titles";
import { recomputeScores } from "@/lib/scoring";
import { nameKey } from "@/lib/normalize";
import { applyExclusionRules } from "@/lib/exclusions";
import { apiSearch } from "@/lib/sources/recherche-entreprises";
import { upsertFromApi } from "@/collect/univers";

const refresh = () => revalidatePath("/", "layout");

export async function toggleFollow(companyId: string) {
  const existing = await prisma.followed.findUnique({ where: { companyId } });
  if (existing) await prisma.followed.delete({ where: { companyId } });
  else await prisma.followed.create({ data: { companyId } });
  refresh();
  return !existing;
}

export async function excludeCompany(companyId: string) {
  await prisma.excluded.upsert({ where: { companyId }, create: { companyId, reason: "manuel" }, update: {} });
  refresh();
}

export async function reincludeCompany(companyId: string) {
  await prisma.excluded.deleteMany({ where: { companyId } });
  refresh();
}

export async function setToolFeedback(toolId: string, feedback: "ok" | "ko") {
  const t = await prisma.toolInPlace.update({ where: { id: toolId }, data: { feedback, feedbackAt: new Date() } });
  await recomputeScores([t.companyId]); // un concurrent écarté change le score
  refresh();
}

export async function deleteExclusionRule(id: string) {
  await prisma.exclusionRule.delete({ where: { id } });
  refresh();
}

/** Marque le compte comme client signé : il sort du périmètre (réintégrable depuis le rail). */
export async function markCustomer(companyId: string) {
  await prisma.company.update({ where: { id: companyId }, data: { isCustomer: true } });
  await prisma.excluded.upsert({ where: { companyId }, create: { companyId, reason: "client" }, update: { reason: "client" } });
  refresh();
}

export async function addContact(companyId: string, form: FormData) {
  const fullName = String(form.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Le nom est obligatoire." };
  const rawTitle = String(form.get("title") ?? "").trim() || null;
  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  const sinceRaw = String(form.get("since") ?? "");
  const norm = normalizeTitle(rawTitle);
  await prisma.contact.create({
    data: { companyId, fullName, rawTitle, function: norm.function, functionFamily: norm.functionFamily, email, since: sinceRaw ? new Date(sinceRaw) : null, source: "manuel" },
  });
  refresh();
  return { ok: true };
}

/** Ajoute (ou complète) une entreprise à partir de son SIREN via Recherche d'entreprises. */
export async function addCompanyBySiren(siren: string) {
  const page = await apiSearch({ q: siren, per_page: 1, page: 1 });
  const api = page.results.find((r) => r.siren === siren);
  if (!api) return { error: "SIREN introuvable dans Recherche d'entreprises." };
  const { id } = await upsertFromApi(api);
  await applyExclusionRules([id]);
  await recomputeScores([id]);
  refresh();
  return { id };
}

/** Création manuelle, sans SIREN (à compléter plus tard par l'univers cible ou un import). */
export async function addCompanyManual(name: string) {
  const n = name.trim();
  if (!n) return { error: "Le nom est obligatoire." };
  const c = await prisma.company.create({ data: { name: n, nameKey: nameKey(n), headcountSource: null } });
  await applyExclusionRules([c.id]);
  await recomputeScores([c.id]);
  refresh();
  return { id: c.id };
}
