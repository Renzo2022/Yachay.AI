export type ExternalSource = 'semantic_scholar' | 'pubmed' | 'crossref' | 'europe_pmc'

export interface ExternalPaper {
  id: string
  source: ExternalSource
  title: string
  authors: string[]
  year: number
  abstract: string
  doi?: string
  url: string
  isOpenAccess: boolean
  citationCount?: number
}

export interface SearchStrategy {
  database: string
  query: string
  notes?: string
}
