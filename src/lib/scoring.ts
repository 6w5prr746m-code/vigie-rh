// Recalcul du score dénormalisé (Company.scoreTotal / scoreParts / lastSignalAt / signalCount).
import { prisma } from "./db";
import { computeScore, DEFAULT_WEIGHTS, type ScoreWeights } from "./score";

export async function loadWeights(): Promise<ScoreWeights> {
  const s = await prisma.setting.findUnique({ where: { key: "scoreWeights" } });
  if (!s) return DEFAULT_WEIGHTS;
  try { return { ...DEFAULT_WEIGHTS, ...JSON.parse(s.value) }; } catch { return DEFAULT_WEIGHTS; }
}

/** Recalcule les scores des entreprises données (toutes si `ids` est omis), par lots. */
export async function recomputeScores(ids?: string[]): Promise<number> {
  const weights = await loadWeights();
  const now = new Date();
  const all = ids ?? (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id);
  const unique = [...new Set(all)];
  for (let i = 0; i < unique.length; i += 200) {
    const batch = await prisma.company.findMany({
      where: { id: { in: unique.slice(i, i + 200) } },
      select: {
        id: true, headcount: true, groupHeadcount: true,
        signals: { select: { type: true, theme: true, function: true, date: true } },
        tools: { where: { OR: [{ feedback: null }, { feedback: { not: "ko" } }] }, select: { tool: true } },
      },
    });
    await prisma.$transaction(
      batch.map((c) => {
        const s = computeScore({ headcount: c.headcount, groupHeadcount: c.groupHeadcount, signals: c.signals, tools: c.tools.map((t) => t.tool) }, now, weights);
        return prisma.company.update({
          where: { id: c.id },
          data: { scoreTotal: s.total, scoreParts: JSON.stringify(s.parts), lastSignalAt: s.last, signalCount: s.count },
        });
      }),
    );
  }
  return unique.length;
}
