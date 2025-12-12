export type StudyType =
  | 'RCT'
  | 'Quasi-experimental'
  | 'Observational'
  | 'Cohort'
  | 'Case-control'
  | 'Cross-sectional'
  | 'Qualitative'
  | 'Systematic Review'

export type ChecklistType = 'CASP' | 'AMSTAR' | 'STROBE'

export type CaspAnswer = 'Yes' | 'Partial' | 'No'

export interface CaspCriterion {
  id: string
  question: string
  answer: CaspAnswer
  notes?: string
  evidence?: string
  justification?: string
}

export type QualityLevel = 'High' | 'Medium' | 'Low'

export interface QualityAssessment {
  id: string
  studyId: string
  studyType: StudyType
  checklistType: ChecklistType
  criteria: CaspCriterion[]
  totalScore: number
  qualityLevel: QualityLevel
  assessedAt: number
}
