// GET ?min=1000&public=0 : estimation par section NAF · POST { min, public, limit } : import
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { estimateUniverse } from "@/lib/sources/recherche-entreprises";
import { importUniverse } from "@/collect/univers";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  try {
    const counts = await estimateUniverse({ minHeadcount: Number(sp.get("min") ?? 1000), includePublic: sp.get("public") === "1" });
    return NextResponse.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const report = await importUniverse(
      { minHeadcount: Number(body.min ?? 1000), includePublic: !!body.public },
      { limit: body.limit ? Number(body.limit) : undefined },
    );
    revalidatePath("/", "layout");
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
