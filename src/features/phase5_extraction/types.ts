export interface ExtractionData {
  id: string
  studyId: string
  evidence: EvidenceRow[]
  variables: string[]
  sample: {
    size: number
    description: string
  }
  methodology: {
    design: string
    duration: string
  }
  intervention: {
    description: string
    tools: string[]
  }
  outcomes: {
    primary: string
    results: string
  }
  conclusions: string
  limitations: string[]
  status: 'empty' | 'extracted' | 'verified' | 'not_extractable'
  context?: {
    year?: number
    country?: string
  }
  effect?: {
    value: number
    lower: number
    upper: number
  }
}

export interface EvidenceRow {
  id: string
  variable: string
  extracted: string
  quote: string
  page?: number
}

export interface EvidenceRowPayload {
  variable: string
  extracted: string
  quote: string
  page?: number
}

export interface ExtractionPayload {
  evidence: EvidenceRowPayload[]
  variables: ExtractionData['variables']
  sample: ExtractionData['sample']
  methodology: ExtractionData['methodology']
  intervention: ExtractionData['intervention']
  outcomes: ExtractionData['outcomes']
  conclusions: ExtractionData['conclusions']
  limitations: ExtractionData['limitations']
  context?: ExtractionData['context']
  effect?: ExtractionData['effect']
}

export const createEmptyExtraction = (studyId: string): ExtractionData => ({
  id: crypto.randomUUID(),
  studyId,
  evidence: [],
  variables: [],
  sample: {
    size: 0,
    description: '',
  },
  methodology: {
    design: '',
    duration: '',
  },
  intervention: {
    description: '',
    tools: [],
  },
  outcomes: {
    primary: '',
    results: '',
  },
  conclusions: '',
  limitations: [],
  status: 'empty',
  context: {},
})
