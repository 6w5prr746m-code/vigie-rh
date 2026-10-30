// Recherche d'une entreprise par nom ou SIREN (pour l'ajout manuel)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiSearch, toCompany } from "@/lib/sources/recherche-entreprises";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ results: [] });
  try {
    const page = await apiSearch({ q, per_page: 10, page: 1, etat_administratif: "A" });
    const sirens = page.results.map((r) => r.siren);
    const known = new Set((await prisma.company.findMany({ where: { siren: { in: sirens } }, select: { siren: true } })).map((c) => c.siren));
    return NextResponse.json({ results: page.results.map((r) => ({ ...toCompany(r), known: known.has(r.siren) })) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
