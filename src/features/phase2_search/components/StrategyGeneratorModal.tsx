import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import type { ExternalSource, Phase2Strategy } from '../types.ts'

type StrategySummaryProps = {
  strategy: Phase2Strategy
  subquestions?: Phase2Strategy['subquestionStrategies']
  onRemoveSubquestion?: (subquestion: string) => void
  disableRemoval?: boolean
  yearFilters?: { from: number; to: number }
  onYearFiltersChange?: (filters: { from: number; to: number }) => void
  onSearchSubquestion?: (subquestion: Phase2Strategy['subquestionStrategies'][number]) => void
  searchingSubquestion?: string | null
  activeSubquestion?: string | null
  selectedSources?: ExternalSource[]
  onGenerateDocumentation?: () => void
}

const COMPONENT_STYLES: Record<
  Phase2Strategy['keywordMatrix'][number]['component'],
  { label: string; color: string; conceptColor: string }
> = {
  P: { label: 'P · Población', color: 'text-[#3b82f6]', conceptColor: 'text-[#3b82f6]' },
  I: { label: 'I · Intervención', color: 'text-[#22c55e]', conceptColor: 'text-[#30c86d]' },
  C: { label: 'C · Comparación', color: 'text-[#f97316]', conceptColor: 'text-[#f9733c]' },
  O: { label: 'O · Resultados', color: 'text-[#9333ea]', conceptColor: 'text-[#af50ea]' },
}

const DEFAULT_FILTERS = 'Idioma: inglés · Tipo: artículos de investigación'
const DEFAULT_YEAR_FILTERS = { from: 2010, to: 2022 }
const FIXED_FILTERS_SUMMARY = 'Idioma: inglés · Tipo: artículos de revista y conferencias revisadas por pares'

export const StrategySummary = ({
  strategy,
  subquestions,
  onRemoveSubquestion,
  disableRemoval = false,
  yearFilters,
  onYearFiltersChange,
  onSearchSubquestion,
  searchingSubquestion,
  activeSubquestion,
  selectedSources,
  onGenerateDocumentation,
}: StrategySummaryProps) => {
  const keywordMatrix = strategy.keywordMatrix ?? []
  const recommendations = strategy.recommendations ?? []
  const displayedSubquestions = subquestions ?? strategy.subquestionStrategies ?? []
  const appliedYearFilters = yearFilters ?? DEFAULT_YEAR_FILTERS

  const handleYearInput = (field: 'from' | 'to', value: string) => {
    if (!onYearFiltersChange) return
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return
    const next = { ...appliedYearFilters, [field]: numeric }
    if (next.from > next.to) return
    onYearFiltersChange(next)
  }

  return (
    <section className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-6 space-y-8 text-black">
      <header className="border-b-3 border-black pb-4 space-y-1">
        <p className="text-xs offenbar font-mono uppercase tracking-[0.3em] text-black">Estrategia generada</p>
        <h3 className="text-3xl font-black uppercase text-black">Resumen de derivaciones PICO y subpreguntas</h3>
        <p className="font-mono text-sm text-black">Basada en la pregunta principal definida en Fase 1.</p>
      </header>

      <div className="space-y-4">
        <div>
          <h4 className="text-2xl font-black uppercase text-black">1. Derivación de términos (PICO)</h4>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-black">
            Bases seleccionadas:{' '}
            {selectedSources && selectedSources.length > 0 ? selectedSources.join(' · ') : 'Selecciona al menos una base'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-3 border-black text-left font-mono text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="border-b-3 border-black px-4 py-2 text-black">Componente</th>
                <th className="border-b-3 border-black px-4 py-2 text-black">Concepto central</th>
                <th className="border-b-3 border-black px-4 py-2 text-black">Términos y sinónimos sugeridos</th>
              </tr>
            </thead>
            <tbody>
              {keywordMatrix.map((entry) => {
                const meta = COMPONENT_STYLES[entry.component]
                return (
                  <tr key={`${entry.component}-${entry.concept}`}>
                    <td className={`border-b-3 border-black px-4 py-3 font-bold ${meta.color}`}>{meta.label}</td>
                    <td className={`border-b-3 border-black px-4 py-3 font-semibold ${meta.conceptColor}`}>{entry.concept}</td>
                    <td className="border-b-3 border-black px-4 py-3 text-black">
                      <span className="block whitespace-pre-wrap">{entry.terms.join(' OR ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h4 className="text-2xl font-black uppercase text-black">2. Subpreguntas · Keywords · Cadenas</h4>
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-black">
            PubMed · Semantic Scholar · CrossRef · Europe PMC
          </span>
        </div>
        <div className="border-3 border-black bg-neutral-50 px-4 py-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-black">Filtros globales</p>
          <p className="text-sm font-mono text-black">{FIXED_FILTERS_SUMMARY}</p>
          <div className="flex flex-wrap gap-3 text-sm font-mono text-black">
            <label className="flex items-center gap-2">
              Desde:
              <input
                type="number"
                min={1900}
                max={appliedYearFilters.to}
                value={appliedYearFilters.from}
                onChange={(event) => handleYearInput('from', event.target.value)}
                className="w-20 border-2 border-black bg-white px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </label>
            <label className="flex items-center gap-2">
              Hasta:
              <input
                type="number"
                min={appliedYearFilters.from}
                max={new Date().getFullYear()}
                value={appliedYearFilters.to}
                onChange={(event) => handleYearInput('to', event.target.value)}
                className="w-20 border-2 border-black bg-white px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4 text-black">
          {displayedSubquestions.length === 0 ? (
            <article className="border-3 border-dashed border-black p-4 bg-neutral-50">
              <p className="font-mono text-sm text-black">
                Todas las subpreguntas fueron descartadas. Restaura o vuelve a generar la estrategia para continuar.
              </p>
            </article>
          ) : null}

          {displayedSubquestions.map((block, index) => (
            <article
              key={block?.subquestion ?? `subquestion-${index}`}
              className={`border-3 border-black p-4 space-y-4 bg-neutral-50 ${
                activeSubquestion && activeSubquestion === block?.subquestion ? 'ring-4 ring-accent-secondary' : ''
              }`}
            >
              <header className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.3em] text-black">
                      Subpregunta #{index + 1}
                    </p>
                    <h5 className="text-xl font-black uppercase text-black">{block?.subquestion ?? 'Subpregunta sin título'}</h5>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {onSearchSubquestion ? (
                      <BrutalButton
                        variant="secondary"
                        size="sm"
                        className="bg-accent-secondary text-black border-black"
                        onClick={() => onSearchSubquestion(block)}
                        disabled={
                          disableRemoval ||
                          !block?.databaseStrategies?.length ||
                          Boolean(searchingSubquestion && searchingSubquestion !== block?.subquestion)
                        }
                      >
                        {searchingSubquestion === block?.subquestion ? 'Buscando...' : 'Buscar papers'}
                      </BrutalButton>
                    ) : null}
                    {onRemoveSubquestion ? (
                      <button
                        type="button"
                        className="border-3 border-black px-3 py-1 text-xs font-mono uppercase bg-accent-danger text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                        onClick={() => block?.subquestion && onRemoveSubquestion(block.subquestion)}
                        disabled={disableRemoval}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="space-y-2">
                <p className="font-mono text-sm text-black">Palabras clave derivadas</p>
                <div className="flex flex-wrap gap-2">
                  {(block?.keywords ?? []).map((keyword) => (
                    <span
                      key={keyword}
                      className="border-2 border-black bg-white px-3 py-1 text-xs font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border-3 border-black bg-white">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="border-b-3 border-black px-3 py-2">Base</th>
                      <th className="border-b-3 border-black px-3 py-2">Cadena de búsqueda</th>
                      <th className="border-b-3 border-black px-3 py-2">Filtros sugeridos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(block?.databaseStrategies ?? []).map((entry, dbIndex) => {
                      const database = entry?.database ?? 'Base sin nombre'
                      const query = entry?.query ?? 'Cadena no disponible'
                      const filtersValue = entry?.filters as unknown
                      let rawFilters: string
                      if (Array.isArray(filtersValue)) {
                        rawFilters = filtersValue.join(' · ')
                      } else if (typeof filtersValue === 'string') {
                        rawFilters = filtersValue
                      } else {
                        rawFilters = DEFAULT_FILTERS
                      }
                      const normalizedFilters = rawFilters
                        .split('·')
                        .map((chunk: string) => chunk.trim())
                        .filter((chunk: string) => chunk.length > 0 && !/^fecha/i.test(chunk))
                        .join(' · ')
                      const displayFilters = normalizedFilters || DEFAULT_FILTERS
                      return (
                        <tr key={`${block?.subquestion ?? 'sub'}-${database}-${dbIndex}`} className="odd:bg-neutral-50">
                          <td className="border-b-3 border-black px-3 py-2 font-bold">{database}</td>
                          <td className="border-b-3 border-black px-3 py-2">
                            <code className="block whitespace-pre-wrap">{query}</code>
                          </td>
                          <td className="border-b-3 border-black px-3 py-2">{displayFilters}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-2xl font-black uppercase text-black">3. Documentación de la estrategia</h4>
            <ul className="list-disc list-inside font-mono text-sm text-black space-y-2">
              {recommendations.map((tip, index) => (
                <li key={`${tip}-${index}`}>{tip}</li>
              ))}
            </ul>
          </div>
          {onGenerateDocumentation ? (
            <BrutalButton
              variant="primary"
              className="self-start"
              onClick={onGenerateDocumentation}
            >
              📄 Generar documentación
            </BrutalButton>
          ) : null}
        </div>
      </div>
    </section>
  )
}
