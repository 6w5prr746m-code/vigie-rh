import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
prisma.company
  .deleteMany({ where: { isDemo: true } })
  .then((r) => console.log(`${r.count} entreprises de démo supprimées (contacts, signaux et outils associés inclus).`))
  .finally(() => prisma.$disconnect());
