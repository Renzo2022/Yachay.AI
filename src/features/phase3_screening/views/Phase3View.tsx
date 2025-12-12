import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScreeningTabs } from '../components/ScreeningTabs.tsx'
import { ScreeningCard } from '../components/ScreeningCard.tsx'
import { PrismaDiagram } from '../components/PrismaDiagram.tsx'
import { useProject } from '../../projects/ProjectContext.tsx'
import {
  confirmCandidateDecision,
  listenToCandidates,
  listenToPrismaData,
  updateCandidateRecord,
} from '../../projects/project.service.ts'
import { createPrismaData, type Candidate, type PrismaData } from '../../projects/types.ts'
import { classifyCandidatesWithCohere } from '../../../services/ai.service.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { BrutalCard } from '../../../core/ui-kit/BrutalCard.tsx'
import { Phase3Checklist } from '../components/Phase3Checklist.tsx'

export const Phase3View = () => {
  const project = useProject()
  const [activeTab, setActiveTab] = useState<'ai' | 'prisma'>('ai')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [prismaData, setPrismaData] = useState<PrismaData>(createPrismaData())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [isBatching, setIsBatching] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [checklistSlot, setChecklistSlot] = useState<HTMLElement | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [prismaGenerated, setPrismaGenerated] = useState(false)
  const candidateRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const highlightTimeout = useRef<number | null>(null)
  const inclusionCriteria = useMemo(
    () => (project.phase1?.inclusionCriteria ?? []).filter((entry: string | undefined) => entry?.trim().length),
    [project.phase1?.inclusionCriteria],
  )
  const exclusionCriteria = useMemo(
    () => (project.phase1?.exclusionCriteria ?? []).filter((entry: string | undefined) => entry?.trim().length),
    [project.phase1?.exclusionCriteria],
  )

  useEffect(() => {
    const unsubscribeCandidates = listenToCandidates(project.id, setCandidates)
    const unsubscribePrisma = listenToPrismaData(project.id, (data) => {
      setPrismaData(data)
    })
    return () => {
      unsubscribeCandidates()
      unsubscribePrisma()
    }
  }, [project.id])

  useEffect(() => {
    if (typeof document === 'undefined') return
    setChecklistSlot(document.getElementById('phase3-checklist-slot'))
    return () => {
      if (highlightTimeout.current) {
        window.clearTimeout(highlightTimeout.current)
      }
    }
  }, [])

  const registerCandidateRef = (id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      candidateRefs.current.set(id, node)
    } else {
      candidateRefs.current.delete(id)
    }
  }

  const handleScrollToCandidate = (id: string) => {
    const target = candidateRefs.current.get(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(id)
      if (highlightTimeout.current) {
        window.clearTimeout(highlightTimeout.current)
      }
      highlightTimeout.current = window.setTimeout(() => setHighlightedId(null), 1800)
    }
  }

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => !candidate.userConfirmed),
    [candidates],
  )
  const screeningComplete = pendingCandidates.length === 0 && candidates.length > 0
  const aiResults = useMemo(
    () =>
      candidates
        .filter((candidate) => Boolean(candidate.aiJustification))
        .map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          decision: (candidate.decision as NonNullable<Candidate['decision']>) ?? 'uncertain',
          justification: candidate.aiJustification ?? candidate.reason ?? 'Sin justificación proporcionada.',
          subtopic: candidate.aiSubtopic ?? '—',
        })),
    [candidates],
  )
  const mainQuestion = project.phase1?.mainQuestion?.trim() || 'Define tu pregunta principal en la Fase 1 para contextualizar el cribado.'

  const allConfirmed = candidates.length > 0 && candidates.every((candidate) => candidate.userConfirmed)
  const duplicatesManaged = prismaData.identified > 0 && prismaData.identified >= prismaData.duplicates
  const exclusionsDocumented =
    allConfirmed &&
    candidates.every((candidate) => {
      if (candidate.decision === 'exclude') {
        return Boolean(candidate.reason)
      }
      return true
    })

  const canGeneratePrisma = duplicatesManaged && screeningComplete && exclusionsDocumented
  const checklistItems = useMemo(
    () => [
      { id: 'dedup', label: 'Eliminar duplicados', completed: duplicatesManaged },
      { id: 'screening', label: 'Cribado inicial (título/resumen)', completed: screeningComplete },
      { id: 'docs', label: 'Documentar exclusiones', completed: exclusionsDocumented },
      { id: 'prisma', label: 'Crear diagrama PRISMA', completed: prismaGenerated && canGeneratePrisma },
    ],
    [duplicatesManaged, screeningComplete, exclusionsDocumented, prismaGenerated, canGeneratePrisma],
  )

  useEffect(() => {
    if (!canGeneratePrisma && activeTab === 'prisma') {
      setActiveTab('ai')
    }
    if (activeTab === 'prisma' && canGeneratePrisma) {
      setPrismaGenerated(true)
    }
    if (!canGeneratePrisma) {
      setPrismaGenerated(false)
    }
  }, [activeTab, canGeneratePrisma])

  const handleBatchScreening = async () => {
    if (pendingCandidates.length === 0 || isBatching) return

    setIsBatching(true)
    setProcessingIds(new Set(pendingCandidates.map((candidate) => candidate.id)))
    setStatusMessage('Procesando cribado automático…')

    try {
      const results = await classifyCandidatesWithCohere(pendingCandidates, project.phase1)
      const pendingMap = new Map(pendingCandidates.map((candidate) => [candidate.id, candidate]))
      const updatedIds = new Set<string>()
      const now = Date.now()
      const summary: Record<NonNullable<Candidate['decision']>, number> = {
        include: 0,
        exclude: 0,
        uncertain: 0,
      }

      await Promise.all(
        results.map(async (entry) => {
          const target = pendingMap.get(entry.id)
          if (!target) return
          updatedIds.add(entry.id)
          summary[entry.decision] += 1

          const shouldConfirm = entry.decision !== 'uncertain'

          if (shouldConfirm) {
            const confirmedCandidate: Candidate = {
              ...target,
              decision: entry.decision,
              reason: entry.justification,
              aiJustification: entry.justification,
              aiSubtopic: entry.subtopic ?? '—',
              confidence: 'medium',
              screeningStatus: 'screened',
              processedAt: now,
              userConfirmed: false,
            }
            await confirmCandidateDecision(project.id, confirmedCandidate, entry.decision)
            await updateCandidateRecord(project.id, entry.id, {
              reason: entry.justification,
              aiJustification: entry.justification,
              aiSubtopic: entry.subtopic ?? '—',
              confidence: 'medium',
              screeningStatus: 'screened',
              processedAt: now,
              userConfirmed: true,
            })
          } else {
            await updateCandidateRecord(project.id, entry.id, {
              decision: entry.decision,
              reason: entry.justification,
              aiJustification: entry.justification,
              aiSubtopic: entry.subtopic,
              confidence: 'low',
              screeningStatus: 'screened',
              processedAt: now,
              userConfirmed: target.userConfirmed ?? false,
            })
          }
        }),
      )

      const fallbackCandidates = pendingCandidates.filter((candidate) => !updatedIds.has(candidate.id))
      if (fallbackCandidates.length) {
        await Promise.all(
          fallbackCandidates.map(async (candidate) => {
            summary.uncertain += 1
            await updateCandidateRecord(project.id, candidate.id, {
              decision: 'uncertain',
              reason: 'Sin respuesta del modelo para este registro.',
              aiJustification: 'Sin respuesta del modelo para este registro.',
              aiSubtopic: candidate.aiSubtopic,
              confidence: 'low',
              screeningStatus: 'screened',
              processedAt: now,
              userConfirmed: false,
            })
          }),
        )
      }

      setStatusMessage(
        `Cribado IA completado · Incluidos ${summary.include}, Excluidos ${summary.exclude}, Dudas ${summary.uncertain}`,
      )
    } catch (error) {
      console.error('handleBatchScreening', error)
      setStatusMessage('Error al clasificar con Cohere')
    } finally {
      setProcessingIds(new Set())
      setIsBatching(false)
      setTimeout(() => setStatusMessage(null), 4000)
    }
  }

  const decisionLabels: Record<NonNullable<Candidate['decision']>, string> = {
    include: 'Incluir',
    exclude: 'Excluir',
    uncertain: 'Duda',
  }
  const decisionClasses: Record<NonNullable<Candidate['decision']>, string> = {
    include: 'bg-accent-success text-main border-black',
    exclude: 'bg-accent-danger text-text-main border-black',
    uncertain: 'bg-accent-warning text-main border-black',
  }

  const aiOverviewCard = (
    <BrutalCard className="bg-neutral-100 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-main">Fase 3 · Cribado</p>
        <h2 className="text-3xl font-black uppercase text-main">Valida y documenta exclusiones</h2>
        <p className="font-mono text-sm text-black">
          Revisa los títulos/resúmenes con IA y actualiza el diagrama PRISMA según los resultados.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-mono text-main">Total guardados: {candidates.length}</p>
      </div>
      <div className="space-y-4">
        <div className="border-3 border-black bg-white p-4 space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">Pregunta principal</p>
          <p className="text-lg font-black text-main">{mainQuestion}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-3 border-black bg-white p-3">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-success">Criterios de inclusión</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-neutral-800 space-y-1">
              {inclusionCriteria.length > 0 ? (
                inclusionCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)
              ) : (
                <li>Sin criterios definidos.</li>
              )}
            </ul>
          </div>
          <div className="border-3 border-black bg-white p-3">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-danger">Criterios de exclusión</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-neutral-800 space-y-1">
              {exclusionCriteria.length > 0 ? (
                exclusionCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)
              ) : (
                <li>Sin criterios definidos.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <BrutalButton
          variant="secondary"
          className="flex-1 bg-accent-warning text-main border-black"
          onClick={handleBatchScreening}
          disabled={pendingCandidates.length === 0 || isBatching}
        >
          🤖 Cribado Automático
        </BrutalButton>
      </div>
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-warning mt-2">
        {pendingCandidates.length} Candidatos pendientes
      </p>
    </BrutalCard>
  )

  const handleConfirm = async (candidate: Candidate, decision: Candidate['decision']) => {
    await confirmCandidateDecision(project.id, candidate, decision)
    setStatusMessage(decision === 'include' ? 'Paper incluido' : 'Paper excluido')
    setTimeout(() => setStatusMessage(null), 2500)
  }

  const checklistPortal = checklistSlot ? createPortal(<Phase3Checklist items={checklistItems} />, checklistSlot) : null

  return (
    <div className="space-y-6">
      {checklistPortal}
      {activeTab === 'ai' && <div className="max-w-6xl mx-auto">{aiOverviewCard}</div>}
      <ScreeningTabs activeTab={activeTab} onChange={setActiveTab} disabledTabs={{ prisma: !canGeneratePrisma }} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Registros identificados', value: prismaData.identified },
          { label: 'Sin resumen (filtrados)', value: prismaData.withoutAbstract },
          { label: 'Duplicados eliminados', value: prismaData.duplicates },
          { label: 'Registros cribados', value: prismaData.screened },
          { label: 'Incluidos tras cribado', value: prismaData.included },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-3 border-black bg-neutral-100 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none"
          >
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-900">{stat.label}</p>
            <p className="text-3xl font-black text-black">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          {activeTab === 'ai' ? (
            <div className="space-y-6">
              {candidates.length === 0 ? (
                <div className="border-4 border-dashed border-accent-warning bg-neutral-900 text-text-main text-center py-20 px-8 shadow-brutal">
                  No hay candidatos cargados. Completa la fase de búsqueda para continuar.
                </div>
              ) : (
                <>
                  {aiResults.length > 0 ? (
                    <div className="border-4 border-black bg-white shadow-brutal overflow-x-auto">
                      <div className="bg-neutral-900 text-text-main px-4 py-2 text-xs font-mono uppercase tracking-[0.3em]">
                        Tabla de cribado asistido
                      </div>
                      <table className="min-w-full table-fixed text-sm font-mono">
                        <thead className="bg-neutral-100 uppercase tracking-[0.2em] text-xs text-black">
                          <tr>
                            <th className="px-4 py-3 text-left">Título</th>
                            <th className="px-4 py-3 text-left">Decisión IA</th>
                            <th className="px-4 py-3 text-left w-1/2">Justificación</th>
                            <th className="px-4 py-3 text-left">Subtema</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiResults.map((result) => (
                            <tr key={result.id} className="border-t border-neutral-200">
                              <td className="px-4 py-3">
                                <p className="font-bold text-main">{result.title}</p>
                                <button
                                  type="button"
                                  className="mt-2 text-xs font-mono uppercase tracking-[0.2em] text-accent-warning underline"
                                  onClick={() => handleScrollToCandidate(result.id)}
                                >
                                  Ver tarjeta
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 inline-block font-black ${decisionClasses[result.decision]}`}>
                                  {decisionLabels[result.decision]}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-neutral-800">{result.justification}</td>
                              <td className="px-4 py-3 text-neutral-800">{result.subtopic}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        ref={registerCandidateRef(candidate.id)}
                        className={`transition-shadow duration-300 ${
                          highlightedId === candidate.id ? 'ring-4 ring-accent-warning' : ''
                        }`}
                      >
                        <ScreeningCard
                          candidate={candidate}
                          processing={processingIds.has(candidate.id)}
                          onConfirm={(decision) => handleConfirm(candidate, decision)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <PrismaDiagram data={prismaData} />
            </div>
          )}
        </div>
      </div>

      {(isBatching || processingIds.size > 0) && (
        <div className="fixed inset-0 bg-black/70 text-text-main flex flex-col gap-4 items-center justify-center font-mono text-xl z-40">
          <div className="w-10 h-10 border-4 border-black bg-accent-warning animate-square-blink" />
          <p>Procesando cribado asistido...</p>
        </div>
      )}

      {statusMessage ? (
        <div className="fixed bottom-6 right-6 border-4 border-black bg-neutral-100 px-4 py-3 font-mono text-main shadow-brutal">
          {statusMessage}
        </div>
      ) : null}
    </div>
  )
}
