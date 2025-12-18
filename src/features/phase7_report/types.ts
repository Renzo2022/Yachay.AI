export interface ManuscriptSection {
  title: string
  content: string
}

export type AnnexesData = {
  prisma: {
    identified: number
    withoutAbstract: number
    duplicates: number
    screened: number
    included: number
  }
  byYear: { name: string; count?: number }[]
  byCountry: { name: string; value?: number }[]
}

export type ManuscriptLanguage = 'es' | 'en'

export interface Manuscript {
  id: string
  projectId: string
  language: ManuscriptLanguage
  title: string
  abstract: string
  abstractEn: string
  keywords: string[]
  keywordsEn: string[]
  authorName: string
  authorOrcid: string
  introduction: string
  methods: string
  results: string
  discussion: string
  conclusions: string
  references: string[]
  referencesFormatted: boolean
  prismaChecklistValidated: boolean
  finalSubmissionReady: boolean
  generatedAt: number
  wordCount: number
}

export const createEmptyManuscript = (projectId: string): Manuscript => ({
  id: crypto.randomUUID(),
  projectId,
  language: 'es',
  title: '',
  abstract: '',
  abstractEn: '',
  keywords: [],
  keywordsEn: [],
  authorName: '',
  authorOrcid: '',
  introduction: '',
  methods: '',
  results: '',
  discussion: '',
  conclusions: '',
  references: [],
  referencesFormatted: false,
  prismaChecklistValidated: false,
  finalSubmissionReady: false,
  generatedAt: Date.now(),
  wordCount: 0,
})
