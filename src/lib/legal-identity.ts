// Identité légale de l'éditeur, injectée dans les pages légales (mentions,
// CGU, confidentialité) à la place de tokens {legalXxx} présents dans les
// messages i18n. Les valeurs viennent de l'environnement : le repo public ne
// contient aucune donnée personnelle, chaque instance affiche les siennes.
// Server-only : ces variables ne sont jamais exposées au client en dehors du
// HTML rendu des pages légales.

const PLACEHOLDER = (name: string) => `[à configurer : ${name}]`

const identity: Record<string, string> = {
  legalOwner: process.env.LEGAL_OWNER || PLACEHOLDER('LEGAL_OWNER'),
  legalAddress: process.env.LEGAL_ADDRESS || PLACEHOLDER('LEGAL_ADDRESS'),
  legalEmail: process.env.LEGAL_EMAIL || PLACEHOLDER('LEGAL_EMAIL'),
  legalSiren: process.env.LEGAL_SIREN || PLACEHOLDER('LEGAL_SIREN'),
  legalSiret: process.env.LEGAL_SIRET || PLACEHOLDER('LEGAL_SIRET'),
  legalRcs: process.env.LEGAL_RCS || PLACEHOLDER('LEGAL_RCS'),
  legalVat: process.env.LEGAL_VAT || PLACEHOLDER('LEGAL_VAT'),
}

function fillString(text: string): string {
  return text.replace(/\{(legal[A-Za-z]+)\}/g, (match, key: string) => identity[key] ?? match)
}

// Remplace récursivement les tokens {legalXxx} dans une valeur issue de
// t.raw() (chaînes, tableaux, objets imbriqués).
export function fillLegalTokens<T>(value: T): T {
  if (typeof value === 'string') {
    return fillString(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => fillLegalTokens(item)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fillLegalTokens(v)])
    ) as T
  }
  return value
}
