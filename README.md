# Vigie RH

Outil personnel de veille commerciale pour la vente de solutions SIRH : signaux (actualités, offres d'emploi, mouvements de décideurs), cartographie des comptes et contacts, score de priorité.

Le prototype validé `vigie-rh-prototype.html` (à la racine) fait référence pour les écrans, les filtres, le score et les thèmes. Ses données sont fictives.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Socle : schéma Prisma, seed de démo, layout, 3 thèmes clair/sombre | ✅ |
| 2 | Écrans Signaux, Cartographie, fiche entreprise, pagination serveur | à venir |
| 3 | Connecteur HubSpot (lecture puis écriture) | à venir |
| 4 | Collecte Sirene, France Travail, actualités + classification Claude | à venir |
| 5 | Score configurable, Priorités, Comptes suivis, badge « nouveaux » | à venir |
| 6 | Export Excel des vues filtrées | à venir |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 6 + SQLite · Vitest.

Les thèmes (Apple, Instagram, Vigie × clair/sombre) sont des variables CSS reprises du prototype (`src/app/globals.css`), exposées à Tailwind via `@theme` (`bg-surface`, `text-muted`, `border-line`…). Le choix de thème est mémorisé dans le navigateur.

## Installation

Prérequis : Node.js 20 ou plus.

```bash
npm install
cp .env.example .env      # puis renseigner les clés
npm run db:push           # crée la base SQLite prisma/dev.db
npm run db:seed           # optionnel : 6 entreprises de démo « [DÉMO] … »
npm run dev               # http://localhost:3000
```

## Variables d'environnement

| Variable | Usage | Étape |
|---|---|---|
| `DATABASE_URL` | Base de données (`file:./dev.db` en local) | 1 |
| `HUBSPOT_TOKEN` | Jeton de la Private App HubSpot | 3 |
| `INSEE_API_KEY` | Clé API Sirene (portail-api.insee.fr) | 4 |
| `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` | Application francetravail.io, API Offres d'emploi v2 | 4 |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Classification et résumé des actualités (défaut `claude-haiku-5-5`) | 4 |

Le fichier `.env` n'est jamais commité (voir `.gitignore`).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run db:push` | Applique le schéma Prisma à la base |
| `npm run db:seed` | Charge les données de démo (fictives, marquées `isDemo`) |
| `npm run db:purge-demo` | Supprime toutes les données de démo |
| `npm run db:studio` | Explorateur de base Prisma Studio |
| `npm run collect` | Collecte des sources (à partir de l'étape 3) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run typecheck` / `npm run lint` | Vérifications TypeScript et ESLint |

## Données de démo

Les entreprises de démo portent le préfixe `[DÉMO]`, n'ont pas de SIREN, utilisent des e-mails en `@exemple.invalid`, et le badge « Données de démo » s'affiche dans la barre tant qu'il en reste. `npm run db:purge-demo` les supprime avec leurs contacts, signaux et outils.

## Passer à Postgres

Dans `prisma/schema.prisma`, remplacer `provider = "sqlite"` par `"postgresql"`, renseigner `DATABASE_URL`, puis `npm run db:push`. Le schéma n'utilise ni enum ni type propre à SQLite.

## Arborescence

```
prisma/            schéma, seed de démo, purge
src/app/           pages (signaux, cartographie, priorites, suivis, reglages) et routes API
src/components/    barre d'app, rail de filtres, tables, tiroir fiche…
src/lib/           référentiels, score, normalisation, accès base
src/collect/       connecteurs et commande `npm run collect`
tests/             tests unitaires
```
