"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeTitle } from "@/lib/titles";
import { recomputeScores } from "@/lib/scoring";

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
