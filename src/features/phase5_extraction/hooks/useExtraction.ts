import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../types.ts'
import { createEmptyExtraction } from '../types.ts'
import { listenToIncludedStudies, updateIncludedStudyRecord } from '../../projects/project.service.ts'
import { listenToExtractionMatrix, saveExtractionEntry } from '../../../services/extraction.service.ts'
import { buildRagContext, extractTextFromPdf, truncateText } from '../../../services/pdf.service.ts'
import { buildPdfProxyUrl, extractDataRAG, resolveSemanticScholarPaper, resolveUnpaywallPdf } from '../../../services/ai.service.ts'
import { useToast } from '../../../core/toast/ToastProvider.tsx'

export const RAG_STEPS = ['Leyendo PDF...', 'Preparando contexto...', 'Consultando LLM...', 'Parseando JSON...']

export type RagState = {
  studyId: string
  stepIndex: number
  label: string
  running: boolean
}

export const useExtraction = (projectId: string) => {
  const [studies, setStudies] = useState<Candidate[]>([])
  const [extractions, setExtractions] = useState<Record<string, ExtractionData>>({})
  const [extractionList, setExtractionList] = useState<ExtractionData[]>([])
  const [ragState, setRagState] = useState<RagState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPreview, setLastPreview] = useState<string>('')
  const { showToast } = useToast()

  const isLikelyPdfUrl = useCallback((value: string) => /\.pdf(\?|#|$)/i.test(value) || /\/pdf\/proxy\?url=/i.test(value), [])

  const normalizePdfUrlInput = useCallback(
    (value: string): { rawUrl: string; fetchUrl: string } => {
      const trimmed = value.trim()
      if (!trimmed) return { rawUrl: '', fetchUrl: '' }

      if (/\/pdf\/proxy\?url=/i.test(trimmed)) {
        try {
          const parsed = new URL(trimmed)
          const raw = parsed.searchParams.get('url')
          return { rawUrl: raw?.trim() || trimmed, fetchUrl: trimmed }
        } catch {
          return { rawUrl: trimmed, fetchUrl: trimmed }
        }
      }

      return { rawUrl: trimmed, fetchUrl: buildPdfProxyUrl(trimmed) }
    },
    [],
  )

  useEffect(() => {
    if (!projectId) return

    const unsubscribeStudies = listenToIncludedStudies(projectId, setStudies)
    const unsubscribeExtraction = listenToExtractionMatrix(projectId, (entries) => {
      const normalized = entries.map((entry) => ({
        ...entry,
        evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
        variables: Array.isArray(entry.variables) ? entry.variables : [],
        conclusions: typeof entry.conclusions === 'string' ? entry.conclusions : '',
      }))

      setExtractionList(normalized)
      setExtractions(
        normalized.reduce<Record<string, ExtractionData>>((acc, entry) => {
          acc[entry.studyId] = entry
          return acc
        }, {}),
      )
    })

    return () => {
      unsubscribeStudies()
      unsubscribeExtraction()
    }
  }, [projectId])

  const getExtractionForStudy = useCallback(
    (studyId: string) => {
      return extractions[studyId]
    },
    [extractions],
  )

  const stats = useMemo(() => {
    return extractionList.reduce(
      (acc, entry) => {
        if (entry.status === 'verified') acc.verified += 1
        else if (entry.status === 'extracted') acc.extracted += 1
        else acc.empty += 1
        return acc
      },
      { empty: 0, extracted: 0, verified: 0 },
    )
  }, [extractionList])

  const autoExtract = useCallback(
    async (study: Candidate, source?: File | string | null) => {
      try {
        const extractDoi = () => {
          if (typeof study.doi === 'string' && study.doi.trim()) return study.doi.trim()
          if (typeof study.id === 'string' && /^10\./.test(study.id)) return study.id
          if (typeof study.url === 'string') {
            const match = study.url.match(/doi\.org\/(10\.[^\s?#]+)/i)
            if (match?.[1]) return match[1]
          }
          return null
        }

        let pdfSource: File | string | null | undefined = source

        if (typeof pdfSource === 'string') {
          const normalized = pdfSource.trim()
          if (!normalized) {
            pdfSource = null
          } else {
            if (!isLikelyPdfUrl(normalized)) {
              throw new Error('El enlace debe ser un PDF directo (.pdf).')
            }
            const normalizedUrl = normalizePdfUrlInput(normalized)

            if (normalizedUrl.rawUrl && normalizedUrl.rawUrl !== (study.pdfUrl ?? '').trim()) {
              try {
                await updateIncludedStudyRecord(projectId, study.id, { pdfUrl: normalizedUrl.rawUrl })
              } catch {
              }
            }

            pdfSource = normalizedUrl.fetchUrl
          }
        }

        if (!pdfSource) {
          if (typeof study.pdfUrl === 'string' && study.pdfUrl.trim()) {
            pdfSource = buildPdfProxyUrl(study.pdfUrl.trim())
          } else if (typeof study.url === 'string' && isLikelyPdfUrl(study.url)) {
            pdfSource = buildPdfProxyUrl(study.url)
          }
        }

        if (!pdfSource) {
          const doi = extractDoi()

          if (doi) {
            const resolved = await resolveUnpaywallPdf(doi)
            if (resolved?.pdfUrl) {
              await updateIncludedStudyRecord(projectId, study.id, { pdfUrl: resolved.pdfUrl })
              pdfSource = buildPdfProxyUrl(resolved.pdfUrl)
            }
          }

          if (!pdfSource && study.source === 'semantic_scholar') {
            const resolved = await resolveSemanticScholarPaper(study.id)
            const pdfUrl = typeof resolved?.openAccessPdfUrl === 'string' ? resolved.openAccessPdfUrl.trim() : ''
            if (pdfUrl && isLikelyPdfUrl(pdfUrl)) {
              await updateIncludedStudyRecord(projectId, study.id, { pdfUrl })
              pdfSource = buildPdfProxyUrl(pdfUrl)
            } else {
              const resolvedDoi = typeof resolved?.doi === 'string' ? resolved.doi.trim() : ''
              if (resolvedDoi) {
                const resolvedUnpaywall = await resolveUnpaywallPdf(resolvedDoi)
                if (resolvedUnpaywall?.pdfUrl) {
                  await updateIncludedStudyRecord(projectId, study.id, { pdfUrl: resolvedUnpaywall.pdfUrl })
                  pdfSource = buildPdfProxyUrl(resolvedUnpaywall.pdfUrl)
                }
              }
            }
          }

          if (!pdfSource) {
            throw new Error('No se encontró PDF Open Access. Arrastra un PDF manualmente para continuar.')
          }
        }

        setError(null)
        const updateStep = (index: number, running = true) =>
          setRagState({ studyId: study.id, stepIndex: index, label: RAG_STEPS[index] ?? '', running })

        updateStep(0)
        const rawText = await extractTextFromPdf(pdfSource)
        updateStep(1)
        const ragContext = buildRagContext(rawText)
        setLastPreview(truncateText(ragContext, 2400).slice(0, 2400))
        updateStep(2)
        const payload = await extractDataRAG(ragContext)
        updateStep(3)

        const existing = getExtractionForStudy(study.id)

        const evidence = (payload.evidence ?? []).map((row) => ({
          id: crypto.randomUUID(),
          variable: row.variable,
          extracted: row.extracted,
          quote: row.quote,
          page: row.page,
        }))

        const entryBase = {
          variables: Array.isArray(payload.variables) ? payload.variables : [],
          conclusions: typeof payload.conclusions === 'string' ? payload.conclusions : '',
        }

        const entry: ExtractionData = existing
          ? {
              ...existing,
              ...payload,
              ...entryBase,
              evidence,
              status: 'extracted',
            }
          : {
              ...createEmptyExtraction(study.id),
              ...payload,
              ...entryBase,
              evidence,
              status: 'extracted',
            }

        await saveExtractionEntry(projectId, entry)
        setRagState({ studyId: study.id, stepIndex: RAG_STEPS.length - 1, label: 'Extracción completada', running: false })
        showToast({ type: 'success', message: `Extracción generada para "${study.title}"` })
        setTimeout(() => setRagState(null), 2000)
        return entry
      } catch (ex) {
        const message = ex instanceof Error ? ex.message : 'No se pudo completar la extracción'
        setError(message)
        showToast({ type: 'error', message })
        setRagState(null)
        throw ex
      }
    },
    [getExtractionForStudy, projectId, showToast],
  )

  const saveExtraction = useCallback(
    async (data: ExtractionData) => {
      await saveExtractionEntry(projectId, data)
      showToast({ type: 'success', message: 'Datos de extracción guardados' })
    },
    [projectId, showToast],
  )

  return {
    studies,
    extractionList,
    getExtractionForStudy,
    autoExtract,
    saveExtraction,
    ragState,
    error,
    clearError: () => setError(null),
    lastPreview,
    stats,
  }
}
