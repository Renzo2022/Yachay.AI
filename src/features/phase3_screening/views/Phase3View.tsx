import { useEffect, useMemo, useState } from 'react'
import { ScreeningTabs } from '../components/ScreeningTabs.tsx'
import { ScreeningCard } from '../components/ScreeningCard.tsx'
import { PrismaDiagram } from '../components/PrismaDiagram.tsx'
import { useProject } from '../../projects/ProjectContext.tsx'
import {
  confirmCandidateDecision,
  listenToCandidates,
  listenToPrismaData,
  updateCandidateRecord,
  updatePrismaData,
} from '../../projects/project.service.ts'
import { createPrismaData, type Candidate, type PrismaData } from '../../projects/types.ts'
import { classifyCandidatesWithCohere } from '../../../services/ai.service.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { BrutalCard } from '../../../core/ui-kit/BrutalCard.tsx'
import { BrutalInput } from '../../../core/ui-kit/BrutalInput.tsx'
import { Phase3Checklist } from '../components/Phase3Checklist.tsx'

export const Phase3View = () => {
  const project = useProject()
  const [activeTab, setActiveTab] = useState<'ai' | 'prisma'>('ai')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [prismaData, setPrismaData] = useState<PrismaData>(createPrismaData())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [isBatching, setIsBatching] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [editingPrisma, setEditingPrisma] = useState({ duplicates: '0', additional: '0' })
  const [showResultsTable, setShowResultsTable] = useState(false)
  const [tableReady, setTableReady] = useState(false)

  useEffect(() => {
    const unsubscribeCandidates = listenToCandidates(project.id, setCandidates)
    const unsubscribePrisma = listenToPrismaData(project.id, (data) => {
      setPrismaData(data)
      setEditingPrisma({
        duplicates: String(data.duplicates),
        additional: String(data.additionalRecords),
      })
    })
    return () => {
      unsubscribeCandidates()
      unsubscribePrisma()
    }
  }, [project.id])

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => !candidate.userConfirmed),
    [candidates],
  )
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

  const checklistItems = useMemo(
    () => [
      { id: 'dedup', label: 'Eliminar duplicados', completed: duplicatesManaged },
      { id: 'screening', label: 'Cribado inicial (título/resumen)', completed: pendingCandidates.length === 0 && candidates.length > 0 },
      { id: 'docs', label: 'Documentar exclusiones', completed: exclusionsDocumented },
    ],
    [duplicatesManaged, pendingCandidates.length, candidates.length, exclusionsDocumented],
  )

  const handleBatchScreening = async () => {
    if (pendingCandidates.length === 0) return
    setShowResultsTable(false)
    setTableReady(false)
    setIsBatching(true)
    setProcessingIds(new Set(pendingCandidates.map((candidate) => candidate.id)))
    setStatusMessage('Enviando candidatos a Cohere…')
    try {
      const results = await classifyCandidatesWithCohere(pendingCandidates, project.phase1)
      const pendingMap = new Map(pendingCandidates.map((candidate) => [candidate.id, candidate]))
      const updatedIds = new Set<string>()
      const now = Date.now()

      await Promise.all(
        results.map(async (entry) => {
          const target = pendingMap.get(entry.id)
          if (!target) return
          updatedIds.add(entry.id)
          await updateCandidateRecord(project.id, entry.id, {
            decision: entry.decision,
            reason: entry.justification,
            aiJustification: entry.justification,
            aiSubtopic: entry.subtopic,
            confidence: 'medium',
            screeningStatus: 'screened',
            processedAt: now,
          })
        }),
      )

      const fallbackUpdates = pendingCandidates
        .filter((candidate) => !updatedIds.has(candidate.id))
        .map((candidate) =>
          updateCandidateRecord(project.id, candidate.id, {
            decision: 'uncertain',
            reason: 'Sin respuesta del modelo para este registro.',
            aiJustification: 'Sin respuesta del modelo para este registro.',
            aiSubtopic: candidate.aiSubtopic,
            confidence: 'low',
            screeningStatus: 'screened',
            processedAt: now,
          }),
        )
      if (fallbackUpdates.length) {
        await Promise.all(fallbackUpdates)
      }

      setTableReady(true)
      setStatusMessage('Cribado IA completado')
    } catch (error) {
      console.error('handleBatchScreening', error)
      setStatusMessage('Error al clasificar con Cohere')
    } finally {
      setProcessingIds(new Set())
      setIsBatching(false)
      setTimeout(() => setStatusMessage(null), 3000)
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

  useEffect(() => {
    if (aiResults.length === 0) {
      setTableReady(false)
      setShowResultsTable(false)
    }
  }, [aiResults.length])

  const handleConfirm = async (candidate: Candidate, decision: Candidate['decision']) => {
    await confirmCandidateDecision(project.id, candidate, decision)
    setStatusMessage(decision === 'include' ? 'Paper incluido' : 'Paper excluido')
    setTimeout(() => setStatusMessage(null), 2500)
  }

  const handlePrismaChange = (key: 'duplicates' | 'additional', value: string) => {
    if (!/^\d*$/.test(value)) return
    setEditingPrisma((prev) => ({ ...prev, [key]: value }))
  }

  const persistPrisma = async () => {
    await updatePrismaData(project.id, {
      duplicates: Number(editingPrisma.duplicates || 0),
      additionalRecords: Number(editingPrisma.additional || 0),
    })
    setStatusMessage('PRISMA actualizado')
    setTimeout(() => setStatusMessage(null), 2000)
  }

  return (
    <div className="space-y-6">
      <ScreeningTabs activeTab={activeTab} onChange={setActiveTab} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Registros identificados', value: prismaData.identified },
          { label: 'Duplicados eliminados', value: prismaData.duplicates },
          { label: 'Registros cribados', value: prismaData.screened },
          { label: 'Incluidos tras cribado', value: prismaData.included },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-3 border-black bg-neutral-100 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none"
          >
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-900">{stat.label}</p>
            <p className="text-3xl font-black text-main">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          {activeTab === 'ai' ? (
            <div className="space-y-6">
              <BrutalCard className="bg-neutral-100 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-warning">
                      {pendingCandidates.length} Candidatos pendientes
                    </p>
                    <p className="text-sm font-mono text-main">Total guardados: {candidates.length}</p>
                  </div>
                </div>
                <div className="border-3 border-black bg-white p-4 space-y-2">
                  <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">Pregunta principal</p>
                  <p className="text-lg font-black text-main">{mainQuestion}</p>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <BrutalButton
                    variant="secondary"
                    className="flex-1 bg-accent-warning text-main border-black"
                    onClick={handleBatchScreening}
                    disabled={pendingCandidates.length === 0 || isBatching}
                  >
                    🤖 Iniciar cribado IA
                  </BrutalButton>
                  <BrutalButton
                    variant="secondary"
                    className="flex-1 bg-neutral-900 text-text-main border-black disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => setShowResultsTable(true)}
                    disabled={!tableReady || isBatching}
                  >
                    📊 Generar tabla
                  </BrutalButton>
                </div>
              </BrutalCard>

              {candidates.length === 0 ? (
                <div className="border-4 border-dashed border-accent-warning bg-neutral-900 text-text-main text-center py-20 px-8 shadow-brutal">
                  No hay candidatos cargados. Completa la fase de búsqueda para continuar.
                </div>
              ) : (
                <>
                  {showResultsTable && tableReady && aiResults.length > 0 ? (
                    <div className="border-4 border-black bg-white shadow-brutal overflow-x-auto">
                      <table className="min-w-full table-fixed text-sm font-mono">
                        <thead className="bg-neutral-900 text-text-main uppercase tracking-[0.2em] text-xs">
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
                      <ScreeningCard
                        key={candidate.id}
                        candidate={candidate}
                        processing={processingIds.has(candidate.id)}
                        onConfirm={(decision) => handleConfirm(candidate, decision)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <BrutalInput
                  label="Duplicados eliminados"
                  labelClassName="text-black"
                  value={editingPrisma.duplicates}
                  onChange={(event) => handlePrismaChange('duplicates', event.target.value)}
                  disabled
                  badge="Auto"
                />
                <BrutalInput
                  label="Registros adicionales"
                  labelClassName="text-black"
                  value={editingPrisma.additional}
                  onChange={(event) => handlePrismaChange('additional', event.target.value)}
                />
              </div>
              <p className="text-xs font-mono text-neutral-600">
                Los duplicados se actualizan automáticamente al guardar candidatos en la Fase 2. Aquí solo debes registrar
                registros adicionales documentados manualmente.
              </p>
              <BrutalButton variant="secondary" className="bg-accent-warning text-main border-black" onClick={persistPrisma}>
                Guardar datos PRISMA
              </BrutalButton>
              <PrismaDiagram data={prismaData} />
            </div>
          )}
        </div>
        <div className="w-full lg:w-80">
          <Phase3Checklist items={checklistItems} />
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

      {allConfirmed ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <BrutalButton variant="primary" className="bg-accent-warning text-main border-black">
            ➡ Finalizar Fase 3
          </BrutalButton>
        </div>
      ) : null}
    </div>
  )
}
