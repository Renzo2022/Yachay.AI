export interface ManuscriptSection {
  title: string
  content: string
}

export interface Manuscript {
  id: string
  projectId: string
  abstract: string
  introduction: string
  methods: string
  results: string
  discussion: string
  conclusions: string
  references: string[]
  generatedAt: number
  wordCount: number
}

export const createEmptyManuscript = (projectId: string): Manuscript => ({
  id: crypto.randomUUID(),
  projectId,
  abstract: '',
  introduction: '',
  methods: '',
  results: '',
  discussion: '',
  conclusions: '',
  references: [],
  generatedAt: Date.now(),
  wordCount: 0,
})
