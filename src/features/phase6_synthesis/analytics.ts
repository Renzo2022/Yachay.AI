import type { Candidate } from '../projects/types.ts'
import type { ExtractionData } from '../phase5_extraction/types.ts'

export type ChartDatum = {
  name: string
  count?: number
  value?: number
}

export interface ForestPlotDatum {
  id: string
  title: string
  effect: number
  lower: number
  upper: number
}

export interface SynthesisStats {
  byYear: ChartDatum[]
  byCountry: ChartDatum[]
  forest: ForestPlotDatum[]
}

const normalizeYear = (value?: number) => {
  if (!value || Number.isNaN(value)) return 'NA'
  return String(value)
}

const normalizeCountry = (value?: string) => {
  if (!value) return 'Desconocido'
  return value.toUpperCase()
}

export const prepareChartsData = (studies: Candidate[], matrix: ExtractionData[]): SynthesisStats => {
  const yearMap = new Map<string, number>()
  const countryMap = new Map<string, number>()
  const forest: ForestPlotDatum[] = []

  const excludedStudyIds = new Set(matrix.filter((entry) => entry.status === 'not_extractable').map((entry) => entry.studyId))

  studies.filter((study) => !excludedStudyIds.has(study.id)).forEach((study) => {
    const yearKey = normalizeYear(study.year)
    yearMap.set(yearKey, (yearMap.get(yearKey) ?? 0) + 1)
  })

  matrix.filter((entry) => entry.status !== 'not_extractable').forEach((entry) => {
    const countryKey = normalizeCountry(entry.context?.country)
    countryMap.set(countryKey, (countryMap.get(countryKey) ?? 0) + 1)

    if (entry.effect) {
      forest.push({
        id: entry.id,
        title: entry.studyId,
        effect: entry.effect.value,
        lower: entry.effect.lower,
        upper: entry.effect.upper,
      })
    }
  })

  const byYear: ChartDatum[] = Array.from(yearMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => Number(a.name) - Number(b.name))

  const byCountry: ChartDatum[] = Array.from(countryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  return {
    byYear,
    byCountry,
    forest,
  }
}
