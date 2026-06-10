/**
 * Article légal générique (CGU, confidentialité, mentions légales).
 * Composant pur : titre + date de mise à jour + sections {heading, paragraphs[]}
 * fournies par les pages depuis `t.raw()` — aucune logique métier.
 */

export type LegalSection = {
  /** Ancre optionnelle (ex. `cgv` pour /legal/cgu#cgv). */
  id?: string
  heading: string
  paragraphs: string[]
}

type LegalArticleProps = {
  title: string
  updated: string
  /** Avertissement optionnel (version EN : « French version prevails »). */
  disclaimer?: string
  sections: LegalSection[]
}

export function LegalArticle({ title, updated, disclaimer, sections }: LegalArticleProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-7">
      <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
        {updated}
      </p>
      {disclaimer && (
        <p className="mt-6 rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-sm text-muted-foreground">
          {disclaimer}
        </p>
      )}
      <div className="mt-10 flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.heading} id={section.id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
