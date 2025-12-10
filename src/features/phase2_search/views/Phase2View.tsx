import { useCallback, useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { SearchHeader } from '../components/SearchHeader.tsx'
import { PaperCard } from '../components/PaperCard.tsx'
import { StrategySummary } from '../components/StrategyGeneratorModal.tsx'
import { Phase2Checklist } from '../components/Phase2Checklist'
import type { ExternalPaper, ExternalSource, Phase2Strategy } from '../types.ts'
import type { Phase2Data } from '../../projects/types.ts'
import { generatePhase2Strategy, searchDatabase } from '../../../services/academic.service.ts'
import { useProject } from '../../projects/ProjectContext.tsx'
import { savePhase2State, saveProjectCandidates } from '../../projects/project.service.ts'
import { createPhase1Defaults } from '../../phase1_planning/types.ts'

const ALL_SOURCES: ExternalSource[] = ['semantic_scholar', 'pubmed', 'crossref', 'europe_pmc']
const SOURCE_LABELS: Record<ExternalSource, string> = {
  semantic_scholar: 'Semantic Scholar',
  pubmed: 'PubMed',
  crossref: 'CrossRef',
  europe_pmc: 'Europe PMC',
}
const INITIAL_YEAR_FILTERS = { from: 2010, to: new Date().getFullYear() }

const sanitizeStrategy = (input: Phase2Strategy | null | undefined): Phase2Strategy | null => {
  if (!input) return null
  return {
    question: input.question ?? '',
    keywordMatrix: Array.isArray(input.keywordMatrix)
      ? input.keywordMatrix.map((entry) => ({
          component: entry?.component ?? 'P',
          concept: entry?.concept ?? '',
          terms: Array.isArray(entry?.terms)
            ? entry.terms.map((term) => term?.toString().trim()).filter((term): term is string => Boolean(term))
            : [],
        }))
      : [],
    subquestionStrategies: Array.isArray(input.subquestionStrategies)
      ? input.subquestionStrategies.map((block) => ({
          subquestion: block?.subquestion ?? '',
          keywords: Array.isArray(block?.keywords)
            ? block.keywords.map((kw) => kw?.toString().trim()).filter((kw): kw is string => Boolean(kw))
            : [],
          databaseStrategies: Array.isArray(block?.databaseStrategies)
            ? block.databaseStrategies.map((strategy) => ({
                database: strategy?.database ?? 'Database',
                query: strategy?.query ?? '',
                filters: strategy?.filters ?? '',
                estimatedResults: strategy?.estimatedResults ?? '',
              }))
            : [],
        }))
      : [],
    recommendations: Array.isArray(input.recommendations)
      ? input.recommendations.map((rec) => rec?.toString().trim()).filter((rec): rec is string => Boolean(rec))
      : [],
  }
}

type Phase2MetaState = {
  lastSearchAt: number | null
  lastSearchSubquestion: string | null
  lastSearchResultCount: number | null
  documentationGeneratedAt: number | null
}

export const Phase2View = () => {
  const project = useProject()
  const [papers, setPapers] = useState<ExternalPaper[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [strategy, setStrategy] = useState<Phase2Strategy | null>(sanitizeStrategy(project.phase2?.lastStrategy))
  const [derivationLoading, setDerivationLoading] = useState(false)
  const [subquestionLoading, setSubquestionLoading] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)
  const [hiddenSubquestions, setHiddenSubquestions] = useState<Set<string>>(
    new Set(project.phase2?.hiddenSubquestions ?? []),
  )
  const [selectedSources, setSelectedSources] = useState<ExternalSource[]>(project.phase2?.selectedSources ?? ALL_SOURCES)
  const [yearFilters, setYearFilters] = useState(project.phase2?.yearFilters ?? INITIAL_YEAR_FILTERS)
  const [searchingSubquestion, setSearchingSubquestion] = useState<string | null>(null)
  const [activeSubquestion, setActiveSubquestion] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [phase2Meta, setPhase2Meta] = useState<Phase2MetaState>({
    lastSearchAt: project.phase2?.lastSearchAt ?? null,
    lastSearchSubquestion: project.phase2?.lastSearchSubquestion ?? null,
    lastSearchResultCount: project.phase2?.lastSearchResultCount ?? null,
    documentationGeneratedAt: project.phase2?.documentationGeneratedAt ?? null,
  })

  useEffect(() => {
    setStrategy(sanitizeStrategy(project.phase2?.lastStrategy))
    setHiddenSubquestions(new Set(project.phase2?.hiddenSubquestions ?? []))
    setSelectedSources(project.phase2?.selectedSources ?? ALL_SOURCES)
    setYearFilters(project.phase2?.yearFilters ?? INITIAL_YEAR_FILTERS)
    setPhase2Meta({
      lastSearchAt: project.phase2?.lastSearchAt ?? null,
      lastSearchSubquestion: project.phase2?.lastSearchSubquestion ?? null,
      lastSearchResultCount: project.phase2?.lastSearchResultCount ?? null,
      documentationGeneratedAt: project.phase2?.documentationGeneratedAt ?? null,
    })
  }, [project.phase2])

  const persistPhase2State = useCallback(
    async (override: Partial<Phase2Data> = {}) => {
      try {
        const payload: Phase2Data = {
          lastStrategy:
            override.lastStrategy !== undefined ? sanitizeStrategy(override.lastStrategy) : sanitizeStrategy(strategy),
          hiddenSubquestions:
            override.hiddenSubquestions !== undefined
              ? [...override.hiddenSubquestions]
              : Array.from(hiddenSubquestions),
          selectedSources: override.selectedSources !== undefined ? override.selectedSources : selectedSources,
          yearFilters: override.yearFilters ?? yearFilters,
          lastSearchAt:
            override.lastSearchAt !== undefined ? override.lastSearchAt : phase2Meta.lastSearchAt ?? null,
          lastSearchSubquestion:
            override.lastSearchSubquestion !== undefined
              ? override.lastSearchSubquestion
              : phase2Meta.lastSearchSubquestion ?? null,
          lastSearchResultCount:
            override.lastSearchResultCount !== undefined
              ? override.lastSearchResultCount
              : phase2Meta.lastSearchResultCount ?? null,
          documentationGeneratedAt:
            override.documentationGeneratedAt !== undefined
              ? override.documentationGeneratedAt
              : phase2Meta.documentationGeneratedAt ?? null,
        }
        await savePhase2State(project.id, payload)
      } catch (error) {
        console.error('persistPhase2State', error)
      }
    },
    [project.id, strategy, hiddenSubquestions, selectedSources, yearFilters, phase2Meta],
  )

  const handleToggleSource = (source: ExternalSource) => {
    setSelectedSources((prev) => {
      const next = prev.includes(source) ? prev.filter((entry) => entry !== source) : [...prev, source]
      persistPhase2State({ selectedSources: next })
      return next
    })
  }

  const handleGenerateDerivation = async () => {
    if (selectedSources.length === 0) {
      showStatus('Selecciona al menos una base de datos para generar estrategias.')
      return
    }
    setPapers([])
    setSearchPerformed(false)
    setActiveSubquestion(null)
    setSelectedIds(new Set())
    setYearFilters(INITIAL_YEAR_FILTERS)
    setDerivationLoading(true)
    setStrategyError(null)
    try {
      const payload = await generatePhase2Strategy(
        project.phase1 ?? createPhase1Defaults(),
        project.name,
        selectedSources,
      )
      const nextHidden = new Set<string>()
      setStrategy(payload)
      setHiddenSubquestions(nextHidden)
      persistPhase2State({ lastStrategy: payload, hiddenSubquestions: Array.from(nextHidden) })
    } catch (error) {
      console.error('handleGenerateStrategies', error)
      setStrategy(null)
      setHiddenSubquestions(new Set())
      setStrategyError('No pudimos generar la estrategia. Intenta nuevamente.')
      persistPhase2State({ lastStrategy: null, hiddenSubquestions: [] })
    } finally {
      setDerivationLoading(false)
    }
  }

  const handleGenerateSubquestionKeywords = async () => {
    if (selectedSources.length === 0) {
      showStatus('Selecciona al menos una base antes de generar keywords.')
      return
    }
    setSubquestionLoading(true)
    setStrategyError(null)
    try {
      const payload = await generatePhase2Strategy(
        project.phase1 ?? createPhase1Defaults(),
        project.name,
        selectedSources,
      )
      const nextStrategy: Phase2Strategy = strategy
        ? { ...strategy, subquestionStrategies: payload.subquestionStrategies, recommendations: payload.recommendations }
        : payload
      const nextHidden = new Set<string>()
      setStrategy(nextStrategy)
      setHiddenSubquestions(nextHidden)
      persistPhase2State({ lastStrategy: nextStrategy, hiddenSubquestions: Array.from(nextHidden) })
      showStatus('Keywords por subpregunta regeneradas.')
    } catch (error) {
      console.error('handleGenerateSubquestionKeywords', error)
      setStrategyError('No pudimos regenerar las keywords por subpregunta. Intenta nuevamente.')
    } finally {
      setSubquestionLoading(false)
    }
  }

  const toggleSelection = (paperId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(paperId)) {
        next.delete(paperId)
      } else {
        next.add(paperId)
      }
      return next
    })
  }

  const selectedPapers = useMemo(() => papers.filter((paper) => selectedIds.has(paper.id)), [papers, selectedIds])

  const visibleSubquestions = useMemo(() => {
    if (!strategy) return []
    return strategy.subquestionStrategies.filter((block) => !hiddenSubquestions.has(block.subquestion))
  }, [strategy, hiddenSubquestions])

  const showStatus = (message: string) => {
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handleRemoveSubquestion = (subquestion: string) => {
    if (!strategy) return
    if (visibleSubquestions.length <= 1) {
      showStatus('Debes conservar al menos una subpregunta.')
      return
    }
    const nextHidden = new Set(hiddenSubquestions)
    nextHidden.add(subquestion)
    setHiddenSubquestions(nextHidden)
    persistPhase2State({ hiddenSubquestions: Array.from(nextHidden) })
    if (activeSubquestion === subquestion) {
      setActiveSubquestion(null)
    }
  }

  const handleYearFiltersChange = (next: { from: number; to: number }) => {
    setYearFilters(next)
    persistPhase2State({ yearFilters: next })
  }

  const handleSearchSubquestion = async (
    block: Phase2Strategy['subquestionStrategies'][number] | undefined,
  ) => {
    if (!block) return
    if (selectedSources.length === 0) {
      showStatus('Selecciona al menos una base antes de buscar.')
      return
    }

    const targetSubquestion = block.subquestion || 'Subpregunta sin título'
    setSearchingSubquestion(targetSubquestion)
    setActiveSubquestion(targetSubquestion)
    setLoading(true)
    setSelectedIds(new Set())

    try {
      const tasks = selectedSources.map(async (source) => {
        const label = SOURCE_LABELS[source].toLowerCase()
        const strategyMatch = (block.databaseStrategies ?? []).find((entry) =>
          (entry?.database ?? '').toLowerCase().includes(label),
        )
        const fallbackQuery =
          strategyMatch?.query || block.keywords?.join(' OR ') || block.subquestion || targetSubquestion
        return await searchDatabase(source, fallbackQuery)
      })

      const results = (await Promise.all(tasks)).flat()
      const filteredByYear = results.filter((paper) => {
        if (!paper.year) return true
        return paper.year >= yearFilters.from && paper.year <= yearFilters.to
      })

      setPapers(filteredByYear)
      setSearchPerformed(true)
      const timestamp = Date.now()
      const nextMeta = {
        lastSearchAt: timestamp,
        lastSearchSubquestion: targetSubquestion,
        lastSearchResultCount: filteredByYear.length,
        documentationGeneratedAt: phase2Meta.documentationGeneratedAt,
      }
      setPhase2Meta(nextMeta)
      persistPhase2State({
        lastSearchAt: timestamp,
        lastSearchSubquestion: targetSubquestion,
        lastSearchResultCount: filteredByYear.length,
      })
      showStatus(
        filteredByYear.length > 0
          ? `${filteredByYear.length} resultados para "${targetSubquestion}".`
          : `Sin resultados para "${targetSubquestion}".`,
      )
    } catch (error) {
      console.error('handleSearchSubquestion', error)
      showStatus('No pudimos ejecutar esa búsqueda. Intenta nuevamente.')
    } finally {
      setSearchingSubquestion(null)
      setLoading(false)
    }
  }

  const handleGenerateDocumentation = () => {
    if (!strategy) {
      showStatus('Necesitas una estrategia generada para documentarla.')
      return
    }
    const timestamp = Date.now()
    setPhase2Meta((prev) => ({ ...prev, documentationGeneratedAt: timestamp }))
    persistPhase2State({ documentationGeneratedAt: timestamp })
    showStatus('📄 Documentación de estrategia generada (prototipo).')
  }

  const checklistItems = [
    {
      id: 'keywords',
      label: 'Extraer términos y sinónimos',
      completed: Boolean(strategy?.keywordMatrix?.length),
    },
    {
      id: 'queries',
      label: 'Diseñar cadenas de búsqueda (subpreguntas validadas)',
      completed: Boolean(strategy?.subquestionStrategies?.length),
    },
    {
      id: 'search',
      label: 'Buscar artículos (bases tradicionales)',
      completed: searchPerformed && papers.length > 0,
    },
    {
      id: 'documentation',
      label: 'Documentar estrategia de búsqueda',
      completed: Boolean(phase2Meta.documentationGeneratedAt),
    },
  ]

  const handleSaveCandidates = async () => {
    if (selectedPapers.length === 0) return
    setSaving(true)
    await saveProjectCandidates(project.id, selectedPapers)
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#00FF00', '#00FFFF', '#FFD300'],
    })
    showStatus(`${selectedPapers.length} candidatos guardados`)
    setSelectedIds(new Set())
    setSaving(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <SearchHeader
            defaultQuestion={project.phase1?.mainQuestion ?? project.name}
            selectedSources={selectedSources}
            onToggleSource={handleToggleSource}
            onGenerateDerivation={handleGenerateDerivation}
            onGenerateSubquestionKeywords={handleGenerateSubquestionKeywords}
            disabled={loading || derivationLoading || subquestionLoading}
          />
        </div>
        <div className="w-full lg:w-80">
          <Phase2Checklist items={checklistItems} />
        </div>
      </div>

      <section className="space-y-6">
        <div className="space-y-6">
          {derivationLoading ? (
            <div className="border-4 border-black bg-neutral-100 shadow-brutal p-6 font-mono text-main">
              ✨ Generando derivación de términos con tus datos de la Fase 1...
            </div>
          ) : null}
          {subquestionLoading ? (
            <div className="border-4 border-black bg-neutral-100 shadow-brutal p-6 font-mono text-main">
              🔁 Construyendo nuevas keywords para subpreguntas...
            </div>
          ) : null}

          {strategyError ? (
            <div className="border-4 border-accent-danger bg-white shadow-brutal p-6 font-mono text-main">
              {strategyError}
            </div>
          ) : null}

          {strategy && !derivationLoading && !subquestionLoading ? (
            <StrategySummary
              strategy={strategy}
              subquestions={visibleSubquestions}
              onRemoveSubquestion={handleRemoveSubquestion}
              disableRemoval={visibleSubquestions.length <= 1}
              yearFilters={yearFilters}
              onYearFiltersChange={handleYearFiltersChange}
              onSearchSubquestion={handleSearchSubquestion}
              searchingSubquestion={searchingSubquestion}
              activeSubquestion={activeSubquestion}
              selectedSources={selectedSources}
              onGenerateDocumentation={handleGenerateDocumentation}
            />
          ) : null}

          {searchPerformed && papers.length === 0 ? (
            <div className="border-4 border-dashed border-accent-success bg-neutral-900 text-text-main text-center py-20 px-8 shadow-brutal">
              <p className="text-3xl font-black uppercase">Sin resultados</p>
              <p className="font-mono mt-2">Ajusta tus fuentes o refina la pregunta para obtener nuevos hallazgos.</p>
            </div>
          ) : null}

          {!searchPerformed ? (
            <div className="border-4 border-black bg-neutral-100 shadow-brutal p-10 text-center space-y-4">
              <p className="text-3xl font-black uppercase text-main">Genera la estrategia y ejecuta cada subpregunta</p>
              <p className="font-mono text-main max-w-2xl mx-auto">
                Selecciona tus bases, genera la estrategia y luego usa el botón “Buscar papers” dentro de cada subpregunta para ver
                resultados específicos.
              </p>
            </div>
          ) : null}

          {papers.length > 0 ? (
            <div className="space-y-4">
              {activeSubquestion ? (
                <p className="text-sm font-mono text-main">
                  Resultados actuales para: <span className="font-bold">{activeSubquestion}</span>
                </p>
              ) : null}
              <div className="grid lg:grid-cols-2 gap-6">
                {papers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    selected={selectedIds.has(paper.id)}
                    onToggle={toggleSelection}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

      </section>

      {loading ? (
        <div className="fixed inset-0 bg-black/75 text-text-main flex items-center justify-center font-mono text-xl z-40">
          {searchingSubquestion ? `🔍 Buscando papers para "${searchingSubquestion}"...` : 'Procesando búsqueda...'}
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 bg-accent-success border-t-4 border-black p-4 flex flex-wrap items-center justify-between gap-4 text-main font-mono z-30">
          <span>{selectedIds.size} papers seleccionados</span>
          <button
            type="button"
            className="border-4 border-black px-6 py-3 bg-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            onClick={handleSaveCandidates}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '💾 Guardar candidatos'}
          </button>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="fixed bottom-6 right-6 bg-neutral-100 border-4 border-black px-4 py-3 font-mono text-main shadow-brutal">
          {statusMessage}
        </div>
      ) : null}

    </div>
  )
}
