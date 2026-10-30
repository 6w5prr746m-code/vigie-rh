"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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
  await prisma.toolInPlace.update({ where: { id: toolId }, data: { feedback, feedbackAt: new Date() } });
  refresh();
}
