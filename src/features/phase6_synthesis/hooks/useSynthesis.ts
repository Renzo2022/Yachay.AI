import { useEffect, useMemo, useState, useCallback } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../../phase5_extraction/types.ts'
import type { SynthesisTheme, SynthesisData } from '../types.ts'
import { createDefaultSynthesis } from '../types.ts'
import { listenToIncludedStudies } from '../../projects/project.service.ts'
import { listenToExtractionMatrix } from '../../../services/extraction.service.ts'
import {
  listenToSynthesisData,
  saveSynthesisData,
} from '../../../services/synthesis.service.ts'
import { prepareChartsData, type SynthesisStats } from '../analytics.ts'
import { generateSynthesis } from '../../../services/ai.service.ts'
import { useToast } from '../../../core/toast/ToastProvider.tsx'

export const useSynthesis = (projectId: string) => {
  const [studies, setStudies] = useState<Candidate[]>([])
  const [matrix, setMatrix] = useState<ExtractionData[]>([])
  const [synthesis, setSynthesis] = useState<SynthesisData>(createDefaultSynthesis())
  const [generating, setGenerating] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (!projectId) return

    const unsubscribeStudies = listenToIncludedStudies(projectId, (items) => setStudies(items))
    const unsubscribeMatrix = listenToExtractionMatrix(projectId, (entries) => setMatrix(entries))
    const unsubscribeSynthesis = listenToSynthesisData(projectId, (data) => setSynthesis(data))

    return () => {
      unsubscribeStudies()
      unsubscribeMatrix()
      unsubscribeSynthesis()
    }
  }, [projectId])

  const stats: SynthesisStats = useMemo(() => prepareChartsData(studies, matrix), [matrix, studies])

  const upsertThemes = useCallback(
    async (nextThemes: SynthesisTheme[]) => {
      setSynthesis((prev) => ({ ...prev, themes: nextThemes }))
      await saveSynthesisData(projectId, { themes: nextThemes })
      showToast({ type: 'success', message: 'Temas actualizados' })
    },
    [projectId, showToast],
  )

  const addTheme = async (theme: Omit<SynthesisTheme, 'id'>) => {
    const next: SynthesisTheme = { ...theme, id: crypto.randomUUID() }
    await upsertThemes([next, ...synthesis.themes])
  }

  const updateTheme = async (theme: SynthesisTheme) => {
    const next = synthesis.themes.map((item) => (item.id === theme.id ? theme : item))
    await upsertThemes(next)
  }

  const deleteTheme = async (themeId: string) => {
    const next = synthesis.themes.filter((theme) => theme.id !== themeId)
    await upsertThemes(next)
  }

  const updateNarrative = async (value: string) => {
    setSynthesis((prev) => ({ ...prev, narrative: value }))
    await saveSynthesisData(projectId, { narrative: value })
    showToast({ type: 'success', message: 'Narrativa guardada' })
  }

  const updateDivergences = async (divergences: string[]) => {
    setSynthesis((prev) => ({ ...prev, divergences }))
    await saveSynthesisData(projectId, { divergences })
    showToast({ type: 'info', message: 'Divergencias actualizadas' })
  }

  const updateGaps = async (gaps: string[]) => {
    setSynthesis((prev) => ({ ...prev, gaps }))
    await saveSynthesisData(projectId, { gaps })
    showToast({ type: 'info', message: 'Vacíos de evidencia actualizados' })
  }

  const generateSynthesisDraft = async () => {
    setGenerating(true)
    try {
      const input = {
        studies: studies.map((study) => {
          const entry = matrix.find((item) => item.studyId === study.id)
          return {
            id: study.id,
            title: study.title,
            year: study.year,
            authors: study.authors,
            country: entry?.context?.country ?? '',
            studyType: study.studyType ?? '',
            qualityLevel: study.qualityLevel ?? '',
            variables: entry?.variables ?? [],
            results: entry?.outcomes?.results ?? entry?.outcomes?.primary ?? '',
            conclusions: entry?.conclusions ?? '',
            evidence: (entry?.evidence ?? []).slice(0, 6).map((row) => ({
              variable: row.variable,
              extracted: row.extracted,
              quote: row.quote,
              page: row.page,
            })),
          }
        }),
      }

      const response = await generateSynthesis(input)

      const themes = (response.themes ?? []).map((theme) => ({
        id: crypto.randomUUID(),
        theme: theme.theme,
        subtheme: theme.subtheme,
        example: theme.example,
        studyCount: theme.studyCount,
        relatedStudies: Array.isArray(theme.relatedStudies) ? theme.relatedStudies : [],
      }))

      await saveSynthesisData(projectId, {
        themes,
        divergences: response.divergences ?? [],
        gaps: response.gaps ?? [],
        narrative: response.narrative ?? '',
      })

      setSynthesis((prev) => ({
        ...prev,
        themes,
        divergences: response.divergences ?? [],
        gaps: response.gaps ?? [],
        narrative: response.narrative ?? '',
      }))

      showToast({ type: 'success', message: 'Síntesis IA lista' })
    } finally {
      setGenerating(false)
    }
  }

  const studyMap = useMemo(() => {
    return studies.reduce<Record<string, Candidate>>((acc, study) => {
      acc[study.id] = study
      return acc
    }, {})
  }, [studies])

  return {
    studies,
    studyMap,
    matrix,
    stats,
    themes: synthesis.themes,
    narrative: synthesis.narrative,
    divergences: synthesis.divergences,
    gaps: synthesis.gaps,
    addTheme,
    updateTheme,
    deleteTheme,
    updateNarrative,
    updateDivergences,
    updateGaps,
    generateSynthesisDraft,
    generating,
  }
}
