import type { ExtractionData } from '../phase5_extraction/types.ts'

export interface SynthesisTheme {
  id: string
  theme: string
  subtheme: string
  example: string
  studyCount: number
  relatedStudies: string[]
}

export interface SynthesisData {
  themes: SynthesisTheme[]
  narrative: string
  divergences: string[]
  gaps: string[]
}

export const createDefaultSynthesis = (): SynthesisData => ({
  themes: [],
  narrative: '',
  divergences: [],
  gaps: [],
})

export type ExtractionMatrix = ExtractionData[]
