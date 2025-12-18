import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Manuscript, AnnexesData, ManuscriptLanguage } from '../types.ts'
import { createEmptyManuscript } from '../types.ts'
import { listenToManuscript, saveManuscript } from '../../../services/manuscript.service.ts'
import { aggregateProjectData } from '../../../services/project-aggregator.service.ts'
import { generateFullManuscript } from '../../../services/ai.service.ts'
import { prepareChartsData } from '../../phase6_synthesis/analytics.ts'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../../phase5_extraction/types.ts'

const PROGRESS_STEPS = [
  'Recopilando datos...',
  'Estructurando Abstract...',
  'Redactando Métodos...',
  'Redactando Resultados...',
  'Redactando Discusión...',
]

const computeWordCount = (manuscript: Manuscript) => {
  const text = [
    manuscript.abstract,
    manuscript.abstractEn,
    manuscript.introduction,
    manuscript.methods,
    manuscript.results,
    manuscript.discussion,
    manuscript.conclusions,
    manuscript.keywords?.join(' ') ?? '',
    manuscript.keywordsEn?.join(' ') ?? '',
    manuscript.references.join(' '),
  ].join(' ')
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export const useReport = (projectId: string) => {
  const [manuscript, setManuscript] = useState<Manuscript | null>(null)
  const [annexes, setAnnexes] = useState<AnnexesData | null>(null)
  const [reportTitle, setReportTitle] = useState<string>('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordsEn, setKeywordsEn] = useState<string[]>([])
  const [matrixRows, setMatrixRows] = useState<Array<{ study: Candidate; extraction?: ExtractionData }>>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buildReportTitle = useCallback((question: string) => {
    const normalized = (question ?? '').trim()
    const withoutMarks = normalized.replace(/[¿?]/g, '').trim()
    const base = withoutMarks || 'Revisión sistemática'
    return `${base}: Una revisión sistemática`
  }, [])

  const buildKeywords = useCallback((keywordMatrix: any) => {
    const terms = Array.isArray(keywordMatrix)
      ? keywordMatrix
          .flatMap((entry) => (Array.isArray(entry?.terms) ? entry.terms : []))
          .map((term) => String(term ?? '').trim())
          .filter(Boolean)
      : []
    const unique = Array.from(new Set(terms))
    return unique.slice(0, 10)
  }, [])

  const buildApaReferences = useCallback((studies: Candidate[]) => {
    const surnameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von'])

    const isInitialsOnly = (raw: string) => {
      const tokens = String(raw ?? '')
        .replace(/[,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
      if (!tokens.length) return false
      return tokens.every((t) => /^[A-Za-z]{1,3}\.?$/.test(t))
    }

    const extractSurname = (tokens: string[]) => {
      if (!tokens.length) return { surname: '', given: [] as string[] }
      let end = tokens.length - 1
      let start = end
      while (start - 1 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1
      if (start - 1 >= 0 && tokens.length <= 3) start -= 1
      const surname = tokens.slice(Math.max(0, start), end + 1).join(' ').trim()
      const given = tokens.slice(0, Math.max(0, start))
      return { surname, given }
    }

    const toInitials = (givenTokens: string[]) =>
      (givenTokens ?? [])
        .map((token) => String(token ?? '').replace(/[^a-zA-ZÀ-ÿ]/g, ''))
        .filter(Boolean)
        .map((token) => `${token[0].toUpperCase()}.`)
        .join(' ')

    const formatAuthor = (raw: string) => {
      const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
      if (!cleaned) return ''

      if (isInitialsOnly(cleaned)) {
        return cleaned
      }

      const commaIndex = cleaned.indexOf(',')
      if (commaIndex > 0) {
        const surname = cleaned.slice(0, commaIndex).trim()
        const given = cleaned
          .slice(commaIndex + 1)
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .filter(Boolean)
        const initials = toInitials(given)
        return initials ? `${surname}, ${initials}`.trim() : surname
      }

      const tokens = cleaned.split(' ').filter(Boolean)
      if (tokens.length === 1) return tokens[0]
      const { surname, given } = extractSurname(tokens)
      const initials = toInitials(given)
      if (!surname) return cleaned
      return initials ? `${surname}, ${initials}`.trim() : surname
    }

    const joinAuthors = (authors: string[]) => {
      const normalized = (authors ?? []).map((name) => formatAuthor(name)).filter(Boolean)
      if (normalized.length === 0) return ''
      if (normalized.length === 1) return normalized[0]
      if (normalized.length === 2) return `${normalized[0]}, & ${normalized[1]}`
      return `${normalized.slice(0, -1).join(', ')}, & ${normalized[normalized.length - 1]}`
    }

    const normalizeDoi = (raw: string) => {
      const cleaned = String(raw ?? '').trim()
      if (!cleaned) return ''
      return cleaned
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
        .replace(/^doi\s*:\s*/i, '')
        .replace(/\s+/g, '')
    }

    const normalizeUrl = (raw: string) => String(raw ?? '').trim()

    const toReference = (study: Candidate) => {
      const title = String(study.title ?? '').trim().replace(/\.+$/g, '')
      const year = study.year ? String(study.year) : 'n.d.'
      const authors = joinAuthors(study.authors ?? [])
      const doiRaw = typeof study.doi === 'string' ? study.doi : ''
      const urlRaw = typeof study.url === 'string' ? study.url : ''

      const doi = normalizeDoi(doiRaw || (urlRaw.includes('doi.org') ? urlRaw : ''))
      const url = normalizeUrl(urlRaw)
      const locator = doi ? `https://doi.org/${doi}` : url
      if (!title) return ''
      if (!locator) return ''
      if (authors) return `${authors} (${year}). ${title}. ${locator}`.trim()
      return `${title}. (${year}). ${locator}`.trim()
    }

    return (studies ?? [])
      .slice()
      .sort((a, b) => {
        const aKey = `${(a.authors?.[0] ?? '').toLowerCase()}-${a.year ?? 0}-${a.title ?? ''}`
        const bKey = `${(b.authors?.[0] ?? '').toLowerCase()}-${b.year ?? 0}-${b.title ?? ''}`
        return aKey.localeCompare(bKey)
      })
      .map((study) => toReference(study))
      .filter(Boolean)
  }, [])

  useEffect(() => {
    if (!projectId) return

    const unsubscribe = listenToManuscript(projectId, (data) => setManuscript(data))
    return unsubscribe
  }, [projectId])

  useEffect(() => {
    if (!projectId || !manuscript) return

    let cancelled = false
    ;(async () => {
      try {
        const aggregated = await aggregateProjectData(projectId)
        const question = aggregated.phase1?.mainQuestion ?? ''
        const derivedTitle = manuscript.title?.trim() ? manuscript.title.trim() : buildReportTitle(question)
        if (!cancelled) setReportTitle(derivedTitle)

        const keywordMatrix = (aggregated.project as any)?.phase2?.lastStrategy?.keywordMatrix
        const derivedKeywords = buildKeywords(keywordMatrix)
        const preferredKeywords = (manuscript.keywords ?? []).filter(Boolean)
        const preferredKeywordsEn = (manuscript.keywordsEn ?? []).filter(Boolean)
        if (!cancelled) {
          setKeywords(preferredKeywords.length ? preferredKeywords : derivedKeywords)
          setKeywordsEn(preferredKeywordsEn)
        }

        const excludedStudyIds = new Set(
          aggregated.extractionMatrix
            .filter((entry) => entry.status === 'not_extractable')
            .map((entry) => entry.studyId)
            .filter(Boolean),
        )

        const reportStudies = aggregated.includedStudies.filter((study) => !excludedStudyIds.has(study.id))

        const stats = prepareChartsData(reportStudies, aggregated.extractionMatrix)
        const nextAnnexes: AnnexesData = {
          prisma: aggregated.prisma,
          byYear: stats.byYear,
          byCountry: stats.byCountry,
        }
        if (!cancelled) setAnnexes(nextAnnexes)

        const extractionByStudyId = new Map<string, ExtractionData>()
        aggregated.extractionMatrix.forEach((entry) => {
          if (entry?.studyId) extractionByStudyId.set(entry.studyId, entry)
        })
        const nextRows = reportStudies.map((study) => ({
          study,
          extraction: extractionByStudyId.get(study.id),
        }))
        if (!cancelled) setMatrixRows(nextRows)

        const refs = manuscript.references ?? []
        const isDefaultPlaceholders =
          refs.length === 2 &&
          refs.includes('PRISMA 2020 Statement') &&
          refs.includes('CASP Qualitative Checklist')
        if (refs.length === 0 || isDefaultPlaceholders) {
          const nextReferences = buildApaReferences(reportStudies)
          if (!cancelled && nextReferences.length) {
            await saveManuscript(projectId, { ...manuscript, references: nextReferences })
          }
        }
      } catch {
        if (!cancelled) setAnnexes(null)
        if (!cancelled) {
          setReportTitle('')
          setKeywords([])
          setKeywordsEn([])
          setMatrixRows([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [buildApaReferences, buildKeywords, buildReportTitle, manuscript, projectId])

  const updateSection = useCallback(
    async (field: keyof Manuscript, value: Manuscript[keyof Manuscript]) => {
      if (!projectId) return
      const base = manuscript ?? createEmptyManuscript(projectId)
      const next: Manuscript = {
        ...base,
        [field]: value,
        wordCount: computeWordCount({ ...base, [field]: value } as Manuscript),
      }
      await saveManuscript(projectId, next)
    },
    [manuscript, projectId],
  )

  const formatReferences = useCallback(async () => {
    if (!projectId) return
    const base = manuscript ?? createEmptyManuscript(projectId)
    let nextReferences = base.references ?? []
    try {
      const aggregated = await aggregateProjectData(projectId)
      const excludedStudyIds = new Set(
        aggregated.extractionMatrix
          .filter((entry) => entry.status === 'not_extractable')
          .map((entry) => entry.studyId)
          .filter(Boolean),
      )
      const reportStudies = aggregated.includedStudies.filter((study) => !excludedStudyIds.has(study.id))
      nextReferences = buildApaReferences(reportStudies)
    } catch {
      // ignore; mark as formatted only if references already present
    }

    const next: Manuscript = {
      ...base,
      references: nextReferences,
      referencesFormatted: Boolean(nextReferences.length),
      wordCount: computeWordCount({ ...base, references: nextReferences } as Manuscript),
    }
    await saveManuscript(projectId, next)
  }, [buildApaReferences, manuscript, projectId])

  const togglePrismaChecklistValidated = useCallback(async () => {
    if (!projectId) return
    const base = manuscript ?? createEmptyManuscript(projectId)
    const next: Manuscript = {
      ...base,
      prismaChecklistValidated: !Boolean(base.prismaChecklistValidated),
      wordCount: computeWordCount(base),
    }
    await saveManuscript(projectId, next)
  }, [manuscript, projectId])

  const toggleFinalSubmissionReady = useCallback(async () => {
    if (!projectId) return
    const base = manuscript ?? createEmptyManuscript(projectId)
    const next: Manuscript = {
      ...base,
      finalSubmissionReady: !Boolean(base.finalSubmissionReady),
      wordCount: computeWordCount(base),
    }
    await saveManuscript(projectId, next)
  }, [manuscript, projectId])

  const generateManuscript = useCallback(async () => {
    if (!projectId) return null
    try {
      setGenerating(true)
      setError(null)
      setProgress({ step: 0, label: PROGRESS_STEPS[0] })
      const aggregated = await aggregateProjectData(projectId)

      for (let index = 1; index < PROGRESS_STEPS.length; index += 1) {
        setProgress({ step: index, label: PROGRESS_STEPS[index] })
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      const generated = await generateFullManuscript(projectId, aggregated, { language: 'es' })
      await saveManuscript(projectId, generated)
      setProgress({ step: PROGRESS_STEPS.length, label: 'Manuscrito completado' })
      setTimeout(() => setProgress(null), 2000)
      return generated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el manuscrito')
      setProgress(null)
      return null
    } finally {
      setGenerating(false)
    }
  }, [projectId])

  const regenerateManuscript = useCallback(async (language: ManuscriptLanguage = 'es') => {
    if (!projectId) return null
    try {
      setGenerating(true)
      setError(null)
      setProgress({ step: 0, label: PROGRESS_STEPS[0] })

      const aggregated = await aggregateProjectData(projectId)

      for (let index = 1; index < PROGRESS_STEPS.length; index += 1) {
        setProgress({ step: index, label: PROGRESS_STEPS[index] })
        await new Promise((resolve) => setTimeout(resolve, 250))
      }

      const regenerated = await generateFullManuscript(projectId, aggregated, { language })
      const base = manuscript ?? createEmptyManuscript(projectId)
      const merged: Manuscript = {
        ...regenerated,
        authorName: base.authorName ?? '',
        authorOrcid: base.authorOrcid ?? '',
        references: base.references ?? [],
        referencesFormatted: base.referencesFormatted ?? false,
        prismaChecklistValidated: base.prismaChecklistValidated ?? false,
        finalSubmissionReady: base.finalSubmissionReady ?? false,
      }
      await saveManuscript(projectId, { ...merged, wordCount: computeWordCount(merged) })
      setProgress({ step: PROGRESS_STEPS.length, label: 'Manuscrito regenerado' })
      setTimeout(() => setProgress(null), 2000)
      return merged
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo regenerar el manuscrito')
      setProgress(null)
      return null
    } finally {
      setGenerating(false)
    }
  }, [manuscript, projectId])

  const progressPercent = useMemo(() => {
    if (!progress) return 0
    return Math.round(((progress.step + 1) / (PROGRESS_STEPS.length + 1)) * 100)
  }, [progress])

  return {
    manuscript,
    annexes,
    reportTitle,
    keywords,
    keywordsEn,
    matrixRows,
    generating,
    progress,
    progressPercent,
    error,
    clearError: () => setError(null),
    generateManuscript,
    regenerateManuscript,
    updateSection,
    formatReferences,
    togglePrismaChecklistValidated,
    toggleFinalSubmissionReady,
  }
}
