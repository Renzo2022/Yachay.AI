import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import type { ExternalSource } from '../types.ts'

type SearchHeaderProps = {
  defaultQuestion: string
  selectedSources: ExternalSource[]
  onToggleSource: (source: ExternalSource) => void
  onGenerateDerivation: () => void
  onGenerateSubquestionKeywords: () => void
  canGenerateSubquestionKeywords: boolean
  disabled?: boolean
}

const SOURCE_OPTIONS: { label: string; value: ExternalSource }[] = [
  { label: 'Semantic Scholar', value: 'semantic_scholar' },
  { label: 'PubMed', value: 'pubmed' },
  { label: 'CrossRef', value: 'crossref' },
  { label: 'Europe PMC', value: 'europe_pmc' },
]

export const SearchHeader = ({
  defaultQuestion,
  selectedSources = [],
  onToggleSource,
  onGenerateDerivation,
  onGenerateSubquestionKeywords,
  canGenerateSubquestionKeywords,
  disabled,
}: SearchHeaderProps) => {
  return (
    <section className="border-4 border-black bg-white p-6 shadow-brutal rounded-none space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-main">Fase 2 · Búsqueda</p>
        <h2 className="text-3xl font-black uppercase text-main">Diseña tu estrategia federada</h2>
        <p className="font-mono text-sm text-black">
          Usa la pregunta PICO y las subpreguntas de la fase anterior para combinar consultas semánticas y booleanas en PubMed,
          Semantic Scholar, CrossRef y Europe PMC.
        </p>
      </header>

      <article className="border-3 border-black bg-neutral-50 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-black">Pregunta principal (PICO)</p>
        <p className="font-mono text-black whitespace-pre-line">{defaultQuestion}</p>
      </article>

      <div className="flex flex-wrap gap-3 font-mono text-sm text-main">
        {SOURCE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 border-3 border-black px-4 py-2 cursor-pointer bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            <input
              type="checkbox"
              checked={selectedSources.includes(option.value)}
              onChange={() => onToggleSource(option.value)}
              className="appearance-none w-5 h-5 border-3 border-black bg-white checked:bg-accent-success checked:border-black cursor-pointer"
              disabled={disabled}
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <BrutalButton
          variant="primary"
          className="flex-1"
          onClick={onGenerateDerivation}
          disabled={selectedSources.length === 0 || disabled}
        >
          ✨ Generar derivación de términos
        </BrutalButton>
        <BrutalButton
          variant="secondary"
          className="flex-1 bg-accent-secondary text-black"
          onClick={onGenerateSubquestionKeywords}
          disabled={selectedSources.length === 0 || disabled || !canGenerateSubquestionKeywords}
          title={
            !canGenerateSubquestionKeywords
              ? 'Genera primero la derivación de términos para habilitar esta acción.'
              : undefined
          }
        >
          🔁 Generar keywords para subpreguntas
        </BrutalButton>
      </div>
    </section>
  )
}
