import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { SearchHeader } from '../components/SearchHeader.tsx'
import { PaperCard } from '../components/PaperCard.tsx'
import { StrategySummary } from '../components/StrategyGeneratorModal.tsx'
import { Phase2Checklist } from '../components/Phase2Checklist.tsx'
import type { ExternalPaper, ExternalSource, Phase2Strategy } from '../types.ts'
import { searchFederated, generatePhase2Strategy } from '../../../services/academic.service.ts'
import { useProject } from '../../projects/ProjectContext.tsx'
import { saveProjectCandidates } from '../../projects/project.service.ts'
import { createPhase1Defaults } from '../../phase1_planning/types.ts'

export const Phase2View = () => {
  const project = useProject()
  const [papers, setPapers] = useState<ExternalPaper[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [strategy, setStrategy] = useState<Phase2Strategy | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)
  const [hiddenSubquestions, setHiddenSubquestions] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleSearch = async (query: string, sources: ExternalSource[]) => {
    setLoading(true)
    setSearchPerformed(true)
    setSelectedIds(new Set())
    const results = await searchFederated(query, sources)
    setPapers(results)
    setLoading(false)
  }

  const handleGenerateStrategies = async () => {
    setStrategyLoading(true)
    setStrategyError(null)
    try {
      const payload = await generatePhase2Strategy(project.phase1 ?? createPhase1Defaults(), project.name)
      setStrategy(payload)
      setHiddenSubquestions(new Set())
    } catch (error) {
      console.error('handleGenerateStrategies', error)
      setStrategy(null)
      setStrategyError('No pudimos generar la estrategia. Intenta nuevamente.')
    } finally {
      setStrategyLoading(false)
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
    setHiddenSubquestions((prev) => {
      const next = new Set(prev)
      next.add(subquestion)
      return next
    })
  }

  const checklistItems = [
    {
      id: 'search',
      label: 'Buscar artículos (bases tradicionales)',
      completed: searchPerformed && papers.length > 0,
    },
    {
      id: 'keywords',
      label: 'Extraer términos y sinónimos',
      completed: Boolean(strategy?.keywordMatrix?.length),
    },
    {
      id: 'queries',
      label: 'Diseñar cadenas de búsqueda (subpreguntas validadas)',
      completed: visibleSubquestions.length > 0,
    },
    {
      id: 'documentation',
      label: 'Documentar estrategia de búsqueda',
      completed: Boolean(strategy?.recommendations?.length),
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
      <SearchHeader
        defaultQuestion={project.phase1?.mainQuestion ?? project.name}
        onSearch={handleSearch}
        onGenerateStrategies={handleGenerateStrategies}
        disabled={loading || strategyLoading}
      />

      <section className="grid lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] gap-6">
        <div className="space-y-6">
          {strategyLoading ? (
            <div className="border-4 border-black bg-neutral-100 shadow-brutal p-6 font-mono text-main">
              ✨ Generando estrategia federada con tus datos de la Fase 1...
            </div>
          ) : null}

          {strategyError ? (
            <div className="border-4 border-accent-danger bg-white shadow-brutal p-6 font-mono text-main">
              {strategyError}
            </div>
          ) : null}

          {strategy && !strategyLoading ? (
            <StrategySummary
              strategy={strategy}
              subquestions={visibleSubquestions}
              onRemoveSubquestion={handleRemoveSubquestion}
              disableRemoval={visibleSubquestions.length <= 1}
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
              <p className="text-3xl font-black uppercase text-main">Listo para buscar</p>
              <p className="font-mono text-main max-w-2xl mx-auto">
                Usa la pregunta PICO de la Fase 1 para disparar consultas en Semantic Scholar y PubMed. La barra inferior te
                permitirá guardar candidatos seleccionados.
              </p>
            </div>
          ) : null}

          {papers.length > 0 ? (
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
          ) : null}
        </div>

        <Phase2Checklist items={checklistItems} />
      </section>

      {loading ? (
        <div className="fixed inset-0 bg-black/75 text-text-main flex items-center justify-center font-mono text-xl z-40">
          🔍 Buscando en el multiverso académico...
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
