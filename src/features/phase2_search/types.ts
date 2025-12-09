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

export type PicoComponent = 'P' | 'I' | 'C' | 'O'

export interface KeywordDerivation {
  component: PicoComponent
  concept: string
  terms: string[]
}

export interface DatabaseStrategy {
  database: string
  query: string
  filters: string
  estimatedResults: string
}

export interface SubquestionStrategy {
  subquestion: string
  keywords: string[]
  databaseStrategies: DatabaseStrategy[]
}

export interface Phase2Strategy {
  question: string
  keywordMatrix: KeywordDerivation[]
  subquestionStrategies: SubquestionStrategy[]
  recommendations: string[]
}
