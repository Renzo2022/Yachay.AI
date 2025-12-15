import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { useProject } from '../../projects/ProjectContext.tsx'
import type { Candidate } from '../../projects/types.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { ExtractionCard } from '../components/ExtractionCard.tsx'
import { ExtractionMatrixTable } from '../components/ExtractionMatrixTable.tsx'
import { DataEditorModal } from '../components/DataEditorModal.tsx'
import { useExtraction, RAG_STEPS } from '../hooks/useExtraction.ts'
import type { ExtractionData } from '../types.ts'

const tabs = [
  { id: 'list', label: 'Lista de extracción' },
  { id: 'matrix', label: 'Matriz comparativa' },
]

const fireConfetti = () =>
  confetti({
    particleCount: 140,
    spread: 70,
    origin: { y: 0.7 },
    colors: ['#FF005C', '#FFD300', '#FFFFFF', '#00FFFF'],
  })

export const Phase5View = () => {
  const project = useProject()
  const [activeTab, setActiveTab] = useState<'list' | 'matrix'>('list')
  const [selectedStudy, setSelectedStudy] = useState<Candidate | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchStatus, setBatchStatus] = useState<string | null>(null)

  const { studies, getExtractionForStudy, autoExtract, saveExtraction, ragState, error, clearError, lastPreview, stats } =
    useExtraction(project.id)

  const matrixRows = useMemo(
    () => studies.map((study) => ({ study, extraction: getExtractionForStudy(study.id) })),
    [studies, getExtractionForStudy],
  )

  const handleAutoExtract = async (study: Candidate, file?: File | string | null) => {
    const entry = await autoExtract(study, file)
    if (entry) fireConfetti()
  }

  const handleSaveExtraction = async (data: ExtractionData) => {
    await saveExtraction(data)
    fireConfetti()
  }

  const handleExtractAll = async () => {
    if (batchRunning) return
    setBatchRunning(true)
    setBatchStatus('Iniciando extracción masiva…')

    try {
      const pending = studies.filter((study) => {
        const existing = getExtractionForStudy(study.id)
        return !existing || existing.status === 'empty'
      })

      for (let index = 0; index < pending.length; index += 1) {
        const study = pending[index]
        setBatchStatus(`Extrayendo ${index + 1}/${pending.length}…`)
        try {
          await autoExtract(study)
        } catch {
        }
      }

      setBatchStatus('Extracción masiva completada')
      fireConfetti()
      setTimeout(() => setBatchStatus(null), 2000)
    } finally {
      setBatchRunning(false)
    }
  }

  const processingStudyId = ragState?.studyId

  const pendingCount = Math.max(0, studies.length - stats.verified)

  return (
    <div className="space-y-6">
      <header className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#FF005C]">Fase 5 · Extracción</p>
          <h1 className="text-3xl font-black text-neutral-900">Matriz de extracción asistida</h1>
          <p className="text-sm font-mono text-neutral-600 max-w-2xl">
            Usa la IA para obtener un borrador y luego ajusta manualmente cada campo antes de verificar los datos.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="border-3 border-black px-4 py-3 bg-neutral-100">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">Estado global</p>
            <p className="text-xl font-black text-neutral-900">
              {stats.verified} verificados · {pendingCount} pendientes
            </p>
            {batchStatus ? <p className="text-xs font-mono text-neutral-600 mt-1">{batchStatus}</p> : null}
          </div>
          <BrutalButton
            variant="primary"
            className="bg-accent-primary text-white"
            onClick={handleExtractAll}
            disabled={batchRunning || studies.length === 0}
          >
            {batchRunning ? 'Extrayendo…' : '⚡ Extraer todo con IA'}
          </BrutalButton>
        </div>
      </header>

      <nav className="flex gap-3 border-4 border-black bg-white px-4 py-2 shadow-[6px_6px_0_0_#111]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 border-3 border-black font-mono text-xs uppercase tracking-tight transition-all ${
              activeTab === tab.id
                ? 'bg-[#FF005C] text-white translate-x-[-2px] translate-y-[-2px]'
                : 'bg-white text-neutral-900 hover:-translate-y-1 hover:-translate-x-1'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'list' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {studies.map((study) => (
            <ExtractionCard
              key={study.id}
              study={study}
              extraction={getExtractionForStudy(study.id)}
              onAutoExtract={(file) => handleAutoExtract(study, file)}
              onEdit={() => setSelectedStudy(study)}
              processing={processingStudyId === study.id && Boolean(ragState?.running)}
              stepLabel={processingStudyId === study.id ? ragState?.label : undefined}
            />
          ))}
          {studies.length === 0 ? (
            <div className="border-4 border-dashed border-black bg-white text-center py-16 font-mono text-sm uppercase tracking-[0.3em]">
              Completa la Fase 3 para traer estudios incluidos.
            </div>
          ) : null}
        </div>
      ) : (
        <ExtractionMatrixTable rows={matrixRows} />
      )}

      <DataEditorModal
        open={Boolean(selectedStudy)}
        study={selectedStudy}
        extraction={selectedStudy ? getExtractionForStudy(selectedStudy.id) : undefined}
        preview={lastPreview}
        onClose={() => setSelectedStudy(null)}
        onSave={handleSaveExtraction}
      />

      {ragState ? (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="border-4 border-white bg-neutral-900 text-white p-8 w-full max-w-xl shadow-[12px_12px_0_0_#111] space-y-4">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#FF005C]">Motor RAG</p>
            <h3 className="text-2xl font-black">Procesando {studies.find((s) => s.id === ragState.studyId)?.title}</h3>
            <div className="space-y-3">
              {RAG_STEPS.map((label, index) => {
                const state =
                  index < ragState.stepIndex ? 'done' : index === ragState.stepIndex ? 'active' : ('pending' as const)
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className={`w-4 h-4 border-2 border-white rounded-full ${
                        state === 'done' ? 'bg-[#FF005C]' : state === 'active' ? 'bg-white' : ''
                      }`}
                    />
                    <span className={state === 'pending' ? 'text-neutral-500' : ''}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="fixed bottom-6 left-6 border-4 border-black bg-white px-5 py-4 shadow-[6px_6px_0_0_#111] flex items-center gap-4">
          <p className="font-mono text-sm text-neutral-900">{error}</p>
          <button
            type="button"
            className="border-3 border-black px-3 py-1 font-mono text-xs uppercase bg-neutral-900 text-white"
            onClick={clearError}
          >
            Entendido
          </button>
        </div>
      ) : null}
    </div>
  )
}
