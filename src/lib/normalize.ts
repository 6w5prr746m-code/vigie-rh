// Normalisation des noms d'entreprise (rapprochement) et des intitulés de poste.

const LEGAL_FORMS = /\b(sa|sas|sasu|sarl|eurl|sca|scs|snc|se|scop|gie|groupe|group|holding|france)\b/g;

export const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function nameKey(name: string): string {
  return stripAccents(name.toLowerCase())
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(LEGAL_FORMS, " ")
    .replace(/\s+/g, " ")
    .trim();
}
