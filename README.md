# Vigie RH

Outil personnel de veille commerciale pour la vente de solutions SIRH : signaux (actualités, offres d'emploi, mouvements de décideurs), cartographie des comptes et contacts, score de priorité.

Le prototype validé `vigie-rh-prototype.html` (à la racine) fait référence pour les écrans, les filtres, le score et les thèmes. Ses données sont fictives.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Socle : schéma Prisma, seed de démo, layout, 3 thèmes clair/sombre | ✅ |
| 2 | Écrans Signaux, Cartographie, fiche entreprise, pagination serveur | ✅ |
| 3a | Mes données sans API : import CSV / Excel (exports HubSpot inclus), liste d'exclusion, saisie | ✅ |
| 3b | Univers cible (Recherche d'entreprises), ajout par SIREN, export pour l'import HubSpot | ✅ |
| 4 | Collecte France Travail (offres + outils), actualités + classification Claude | ✅ |
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
| `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` | Application francetravail.io, API Offres d'emploi v2 | 4 |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Classification et résumé des actualités (défaut `claude-haiku-5-5`) ; sans clé, classement par mots-clés | 4 |
| `NEWS_FEEDS` | Flux RSS additionnels, séparés par des virgules (facultatif) | 4 |

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
| `npm run import -- --kind=entreprises\|contacts\|exclusions --file=…` | Import d'un fichier CSV / XLSX en ligne de commande (`--dry-run` : affiche la correspondance des colonnes ; `--no-create` : n'invente pas d'entreprise pour un contact orphelin) |
| `npm run collect -- --source=univers --limit=5` | Univers cible : test sur 5 entreprises (`--estimate` : compte seulement ; `--min=1000` ; `--public` pour inclure le public) |
| `npm run collect -- --source=univers` | Univers cible complet (≥ 1 000 salariés, hors public par défaut) |
| `npm run collect -- --source=france-travail --limit=5` | Offres d'emploi : test (5 offres enregistrées) ; `--days=7` (1, 3, 7, 14, 31), `--keywords=SIRH,paie` |
| `npm run collect -- --source=news --limit=3` | Actualités : test sur 3 comptes suivis ; `--top=50` ajoute les 50 meilleurs scores ; `--days=30` |
| `npm run collect -- --source=all` | France Travail puis actualités, puis recalcul de tous les scores (à planifier) |
| `npm run collect -- --source=scores` | Recalcule tous les scores |
| `npm test` | Tests unitaires (Vitest) |
| `npm run typecheck` / `npm run lint` | Vérifications TypeScript et ESLint |

## Écrans

- **Signaux** (`/signaux`) : filtres période, thèmes, fonctions + périmètre entreprise ; compteurs par type ; tri entreprise / type / date.
- **Cartographie** (`/cartographie`) : bascule Entreprises / Contacts, filtres ancienneté du dernier signal, outils en place (les outils signalés « faux » sont ignorés), fonctions (vue Contacts).
- **Fiche entreprise** : tiroir ouvert par `?fiche=<id>` (lien partageable), score détaillé, outils avec confirmation / correction, contacts par famille de fonction, 30 derniers signaux ; suivre, exclure du périmètre.

Les filtres, le tri et la page sont dans l'URL : une vue filtrée se recharge à l'identique. Pagination côté serveur (25, 50 ou 100 lignes via `per`), sans plafond de résultats.

## Importer mes données (sans connexion HubSpot)

Page **Importer** (`/importer`) ou commande `npm run import`. Formats : CSV (séparateur `,` ou `;` détecté) et Excel `.xlsx`.

1. **Entreprises** : export HubSpot « Entreprises » ou fichier maison. En-têtes HubSpot reconnus en français et en anglais (Record ID, Nom de l'entreprise, Nombre d'employés, Secteur d'activité, Phase du cycle de vie, Entreprise parente…). La correspondance se corrige à l'écran.
   - Phase du cycle de vie « Client » / « Customer » (ou colonne Client = oui) → compte marqué client et exclu du périmètre.
   - Secteur HubSpot ou code NAF → secteur du référentiel ; « Entreprise parente » → lien maison mère / filiale.
2. **Contacts** : export HubSpot « Contacts » (ajouter « Entreprise associée principale » et son ID à la vue). L'intitulé est normalisé en fonction + famille (DRH, Responsable SIRH, Gestionnaire de paie…). Option : créer les entreprises introuvables.
3. **Liste d'exclusion** : SIREN et / ou nom de vos clients. Les règles s'appliquent aussi aux comptes importés plus tard ; gérables dans la colonne de droite de `/importer`.

**Ré-import** : sans doublon (rapprochement par ID HubSpot, SIREN, nom normalisé, e-mail). Un contact qui change d'entreprise génère un signal **Départ** (ancienne) et **Arrivée** (nouvelle) ; un changement de fonction génère une **Arrivée** sur le poste. Les scores des comptes touchés sont recalculés.

**Saisie** depuis la fiche : « + Ajouter un contact », « Client signé » (exclut le compte ; réintégrable depuis le rail).

Exemples fictifs de fichiers : `tests/fixtures/`.

### Univers cible

Carte « Univers cible » de `/importer` ou `npm run collect -- --source=univers`. Interroge l'API publique [Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr) (sans clé) : entreprises actives, tranche d'effectif INSEE ≥ 1 000 salariés par défaut, une requête paginée par section NAF, secteur public écarté (catégories juridiques 4xxx / 7xxx, section O, services publics) sauf option contraire.

- L'effectif enregistré est la **borne basse de la tranche INSEE** (ex. 1 000 pour « 1 000 à 1 999 ») ; un effectif précis venu de vos fichiers n'est jamais écrasé.
- Une entreprise déjà importée sans SIREN (export HubSpot) est **complétée** si son nom normalisé correspond sans ambiguïté, au lieu d'être dupliquée.
- La liste d'exclusion s'applique aux comptes créés.
- **Premier essai conseillé** : `npm run collect -- --source=univers --estimate`, puis `--limit=5`, avant l'import complet (quelques minutes, débit limité à ~6 requêtes / s).

Bouton **+ Ajouter** (Cartographie) : recherche par nom ou SIREN dans la même API, ou création manuelle sans SIREN.

### Retour vers HubSpot (sans API)

- **Export HubSpot** (Cartographie) : CSV des entreprises ou contacts de la vue filtrée, en-têtes reconnus par l'assistant d'import HubSpot (Company name, Company Domain Name, Number of Employees, First Name, Email, Job Title…) + colonnes Vigie RH (SIREN, score, derniers signaux) à associer à des propriétés personnalisées ou à ignorer. Données de démo exclues.
- **Copier pour HubSpot** (fiche) : résumé daté des signaux et outils, à coller en note sur l'entreprise.

## Collecte automatique (étape 4)

### Offres d'emploi — France Travail

1. Créez une application sur [francetravail.io](https://francetravail.io) (espace partenaire), ajoutez-lui l'API **« Offres d'emploi v2 »**, puis copiez l'identifiant et la clé secrète dans `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET`.
2. Test : `npm run collect -- --source=france-travail --limit=5`.

Fonctionnement : recherches par mots-clés (SIRH, HRIS, paie, payroll, GTA, DRH, RRH, ressources humaines, formation, talents) sur les 7 derniers jours ; seules les offres dont l'intitulé correspond à une fonction du référentiel sont gardées. L'API ne fournit pas le SIRET : l'offre est rattachée par **nom d'employeur normalisé**, uniquement s'il correspond à une seule entreprise en base. Les annonces de cabinets ou d'agences « pour le compte d'un client » sont écartées. La commande liste les employeurs non rattachés les plus fréquents, à ajouter via « + Ajouter » si pertinent.

**Outils en place** : les outils du référentiel cités dans l'annonce (Workday, SAP HR, Silae, Kelio…) alimentent la fiche avec la source « france-travail » ; la confiance monte avec le nombre d'offres distinctes qui les citent (1 offre → 2/5, 4 offres et plus → 5/5). Vos confirmations / corrections restent prioritaires.

### Actualités — Google News + Claude

- Périmètre : vos **comptes suivis** (★), plus les N meilleurs scores avec `--top=N`. Comptes exclus et démo ignorés.
- Un flux Google News par compte (articles des 30 derniers jours citant le nom exact), plus les flux de `NEWS_FEEDS` ; dédoublonnage par lien et par titre.
- Classification par **Claude Haiku 5.5** (sortie JSON structurée, effort `low`, lots de 15 articles) : pertinence (homonymes écartés), type (actualité entreprise, décideur, arrivée / départ dans une fonction RH-SIRH-Paie-GTA…), thème du référentiel, résumé d'une ligne. Les réponses sont ramenées aux référentiels avant enregistrement.
- Sans `ANTHROPIC_API_KEY`, un classement par mots-clés prend le relais (résumé = titre).

### Planifier (cron)

Exemple, chaque jour ouvré à 7 h 10 (`crontab -e`, en adaptant le chemin) :

```
10 7 * * 1-5 cd /chemin/vers/vigie-rh && /usr/bin/env npm run collect -- --source=all >> collect.log 2>&1
```

Les effectifs proviennent de l'univers cible (tranches INSEE de Recherche d'entreprises) ; une clé API Sirene n'est pas nécessaire.

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
