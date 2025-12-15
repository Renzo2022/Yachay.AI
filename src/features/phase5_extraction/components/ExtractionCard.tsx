import { useMemo, useState } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../types.ts'

interface ExtractionCardProps {
  study: Candidate
  extraction?: ExtractionData
  onAutoExtract: (file?: File | string | null) => Promise<void>
  onEdit: () => void
  processing?: boolean
  stepLabel?: string
}

const statusStyles: Record<string, string> = {
  pending: 'bg-white text-black border-dashed',
  extracted: 'bg-yellow-300 text-black',
  verified: 'bg-green-400 text-black',
}

export const ExtractionCard = ({ study, extraction, onAutoExtract, onEdit, processing, stepLabel }: ExtractionCardProps) => {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusLabel, statusClass] = useMemo(() => {
    const level = extraction?.status ?? 'empty'
    if (level === 'verified') return ['Verificado', statusStyles.verified]
    if (level === 'extracted') return ['Pendiente', statusStyles.extracted]
    return ['Pendiente', statusStyles.pending]
  }, [extraction])

  const handleAutoExtract = async (file?: File | string | null) => {
    try {
      setLoading(true)
      await onAutoExtract(file)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      await handleAutoExtract(file)
    }
  }

  return (
    <div className="border-4 border-black bg-white shadow-[8px_8px_0_0_#111] p-5 flex flex-col gap-4">
      <header>
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-primary">{study.source}</p>
        <h3 className="text-2xl font-black text-neutral-900">{study.title}</h3>
        <p className="text-sm font-mono text-neutral-600">
          {study.authors.join(', ')} · {study.year}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <span className={`px-4 py-2 border-3 border-black font-mono text-sm uppercase tracking-tight ${statusClass}`}>
          {statusLabel}
        </span>
        {extraction?.status === 'extracted' ? (
          <span className="text-xs font-mono text-neutral-600 uppercase tracking-wide">Borrador IA</span>
        ) : null}
        {extraction ? (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-2 border-3 border-black bg-white text-black px-4 py-2 font-mono uppercase shadow-[4px_4px_0_0_#111] hover:-translate-y-1 hover:-translate-x-1"
          >
            ✏️ Ver/Editar Datos
          </button>
        ) : (
          <button
            type="button"
            disabled={loading || processing}
            onClick={() => handleAutoExtract()}
            className={`ml-auto inline-flex items-center gap-2 border-3 border-black bg-accent-primary text-white px-4 py-2 font-mono uppercase shadow-[4px_4px_0_0_#111] ${
              loading || processing ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1 hover:-translate-x-1'
            }`}
          >
            ⚡ {loading || processing ? stepLabel ?? 'Extrayendo…' : 'Auto-Extraer con IA'}
          </button>
        )}
      </div>

      {!extraction && (
        <div
          className={`border-4 border-dashed border-black bg-neutral-50 text-black text-center p-6 font-mono text-sm uppercase tracking-[0.3em] ${
            dragOver ? 'bg-accent-primary/20' : ''
          }`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          Arrastra PDF aquí
        </div>
      )}
    </div>
  )
}
