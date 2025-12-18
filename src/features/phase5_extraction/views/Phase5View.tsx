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
import { createEmptyExtraction } from '../types.ts'

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

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const toCsvField = (value: unknown, delimiter: string) => {
  const text = String(value ?? '')
  const needsQuotes = text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(delimiter)
  if (!needsQuotes) return text
  return `"${text.replace(/"/g, '""')}"`
}

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

  const exportableMatrixRows = useMemo(
    () => matrixRows.filter((row) => row.extraction?.status !== 'not_extractable'),
    [matrixRows],
  )

  const handleAutoExtract = async (study: Candidate, file?: File | string | null) => {
    try {
      const entry = await autoExtract(study, file)
      if (entry) fireConfetti()
    } catch {
    }
  }

  const handleSaveExtraction = async (data: ExtractionData) => {
    await saveExtraction(data)
    if (data.status === 'verified') fireConfetti()
  }

  const handleMarkNotExtractable = async (study: Candidate) => {
    const existing = getExtractionForStudy(study.id)
    const next: ExtractionData = {
      ...(existing ?? createEmptyExtraction(study.id)),
      status: 'not_extractable',
    }
    await saveExtraction(next)
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

  const resolvedCount = stats.verified + stats.not_extractable
  const pendingCount = Math.max(0, studies.length - resolvedCount)

  const handleDownloadMatrixCsv = async () => {
    const delimiter = ';'
    const headers = [
      'Autor',
      'Año',
      'País',
      'Tipo de estudio',
      'Población',
      'Variables',
      'Resultados',
      'Conclusiones',
      'Nivel de evidencia',
      'Estado',
    ]

    const rows = exportableMatrixRows.map(({ study, extraction }) => {
      const authors = Array.isArray(study.authors) && study.authors.length ? study.authors.join(', ') : ''
      const year = study.year || extraction?.context?.year || ''
      const country = extraction?.context?.country?.trim() ? extraction.context.country.trim() : ''
      const studyType = study.studyType ?? ''
      const population = extraction?.sample?.description?.trim() ? extraction.sample.description.trim() : ''
      const variables = extraction?.variables?.length ? extraction.variables.join(', ') : ''
      const results = extraction?.outcomes?.results?.trim() ? extraction.outcomes.results.trim() : ''
      const conclusions = extraction?.conclusions?.trim() ? extraction.conclusions.trim() : ''
      const evidenceLevel = study.qualityLevel ?? ''

      const statusKey = extraction?.status ?? 'empty'
      const statusLabel = statusKey === 'verified' ? 'Verificado' : statusKey === 'not_extractable' ? 'No extraíble' : 'Pendiente'

      return [authors, year, country, studyType, population, variables, results, conclusions, evidenceLevel, statusLabel]
        .map((value) => toCsvField(value, delimiter))
        .join(delimiter)
    })

    const bom = '\ufeff'
    const content = [headers.map((h) => toCsvField(h, delimiter)).join(delimiter), ...rows].join('\n')
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `matriz-comparativa-${project.id}.csv`)
  }

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
              {stats.verified} verificados · {stats.not_extractable} no extraíbles · {pendingCount} pendientes
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

      <nav className="flex items-center gap-3 border-4 border-black bg-white px-4 py-2 shadow-[6px_6px_0_0_#111]">
        <div className="flex gap-3">
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
        </div>

        <button
          type="button"
          onClick={handleDownloadMatrixCsv}
          disabled={activeTab !== 'matrix' || exportableMatrixRows.length === 0}
          className={`ml-auto px-4 py-2 border-3 border-black font-mono text-xs uppercase tracking-tight transition-all shadow-[4px_4px_0_0_#111] ${
            activeTab !== 'matrix' || exportableMatrixRows.length === 0
              ? 'bg-neutral-200 text-neutral-700 opacity-70 cursor-not-allowed'
              : 'bg-white text-neutral-900 hover:-translate-y-1 hover:-translate-x-1'
          }`}
        >
          Descargar tabla (CSV)
        </button>
      </nav>

      {activeTab === 'list' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {studies.map((study) => (
            <ExtractionCard
              key={study.id}
              study={study}
              extraction={getExtractionForStudy(study.id)}
              onAutoExtract={(file) => handleAutoExtract(study, file)}
              onMarkNotExtractable={() => handleMarkNotExtractable(study)}
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
        <ExtractionMatrixTable rows={exportableMatrixRows} />
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
