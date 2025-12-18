import { useEffect, useMemo, useState } from 'react'
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
  const [pdfUrl, setPdfUrl] = useState(study.pdfUrl ?? '')
  const [statusLabel, statusClass] = useMemo(() => {
    const level = extraction?.status ?? 'empty'
    if (level === 'verified') return ['Verificado', statusStyles.verified]
    if (level === 'extracted') return ['Pendiente', statusStyles.extracted]
    return ['Pendiente', statusStyles.pending]
  }, [extraction])

  useEffect(() => {
    setPdfUrl(study.pdfUrl ?? '')
  }, [study.pdfUrl])

  const normalizedPdfUrl = pdfUrl.trim()
  const looksLikeDirectPdf = /^https?:\/\//i.test(normalizedPdfUrl) || /\/pdf\/proxy\?url=/i.test(normalizedPdfUrl)

  const handleAutoExtract = async (file?: File | string | null) => {
    try {
      setLoading(true)
      await onAutoExtract(file)
    } finally {
      setLoading(false)
    }
  }

  const handleUrlExtract = async () => {
    if (!normalizedPdfUrl) return
    if (!looksLikeDirectPdf) return
    await handleAutoExtract(normalizedPdfUrl)
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
        <div className="space-y-3">
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

          <div className="border-3 border-black bg-white p-3">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-600">O pega un link directo</p>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 border-3 border-black bg-white px-3 py-2 font-mono text-xs text-black placeholder:text-neutral-500"
                placeholder="https://.../paper.pdf"
                value={pdfUrl}
                onChange={(event) => setPdfUrl(event.target.value)}
              />
              <button
                type="button"
                disabled={loading || processing || !normalizedPdfUrl || !looksLikeDirectPdf}
                onClick={handleUrlExtract}
                className={`border-3 border-black px-3 py-2 font-mono text-xs uppercase shadow-[4px_4px_0_0_#111] ${
                  loading || processing || !normalizedPdfUrl || !looksLikeDirectPdf
                    ? 'bg-neutral-200 text-neutral-600 cursor-not-allowed'
                    : 'bg-accent-primary text-white hover:-translate-y-1 hover:-translate-x-1'
                }`}
              >
                Usar link
              </button>
            </div>
            {!normalizedPdfUrl ? null : !looksLikeDirectPdf ? (
              <p className="mt-2 font-mono text-[10px] text-neutral-600">
                El enlace debe ser una URL válida (http/https) que devuelva un PDF.
              </p>
            ) : (
              <p className="mt-2 font-mono text-[10px] text-neutral-600">Se guardará para próximas extracciones.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
