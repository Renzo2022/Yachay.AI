import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Manuscript } from '../types.ts'
import { createEmptyManuscript } from '../types.ts'
import { listenToManuscript, saveManuscript } from '../../../services/manuscript.service.ts'
import { aggregateProjectData } from '../../../services/project-aggregator.service.ts'
import { generateFullManuscript } from '../../../services/ai.service.ts'

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
    manuscript.introduction,
    manuscript.methods,
    manuscript.results,
    manuscript.discussion,
    manuscript.conclusions,
    manuscript.references.join(' '),
  ].join(' ')
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export const useReport = (projectId: string) => {
  const [manuscript, setManuscript] = useState<Manuscript | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    const unsubscribe = listenToManuscript(projectId, (data) => setManuscript(data))
    return unsubscribe
  }, [projectId])

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

      const generated = await generateFullManuscript(projectId, aggregated)
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

  const progressPercent = useMemo(() => {
    if (!progress) return 0
    return Math.round(((progress.step + 1) / (PROGRESS_STEPS.length + 1)) * 100)
  }, [progress])

  return {
    manuscript,
    generating,
    progress,
    progressPercent,
    error,
    clearError: () => setError(null),
    generateManuscript,
    updateSection,
  }
}
