import type { Phase1Data } from '../features/phase1_planning/types.ts'
import type { DatabaseStrategy, ExternalPaper, ExternalSource, KeywordDerivation, Phase2Strategy } from '../features/phase2_search/types.ts'

const mockPapers: ExternalPaper[] = [
  {
    id: 'sem-001',
    source: 'semantic_scholar',
    title: 'Gamification frameworks for evidence-based medical training',
    authors: ['M. Quiroga', 'L. Andrade'],
    year: 2024,
    abstract:
      'Esta revisión explora cómo la gamificación y los modelos IA pueden acelerar la formación clínica basada en evidencia, destacando métricas de compromiso y retención.',
    doi: '10.5555/sem001',
    url: 'https://www.semanticscholar.org/paper/sem-001',
    isOpenAccess: true,
    citationCount: 42,
  },
  {
    id: 'sem-002',
    source: 'semantic_scholar',
    title: 'LLM-assisted search strategies for systematic reviews in STEM',
    authors: ['A. Peralta', 'D. Muñoz'],
    year: 2023,
    abstract:
      'Propone prompts optimizados para combinar consultas booleanas y modelos generativos al construir protocolos PICO en áreas STEM.',
    url: 'https://www.semanticscholar.org/paper/sem-002',
    isOpenAccess: false,
    citationCount: 18,
  },
  {
    id: 'pub-101',
    source: 'pubmed',
    title: 'Gamification for mental health interventions in higher education',
    authors: ['K. Villavicencio'],
    year: 2022,
    abstract:
      'Meta-análisis sobre el impacto de módulos gamificados para reducir ansiedad académica, integrando biometría y feedback personalizado.',
    doi: '10.7777/pub101',
    url: 'https://pubmed.ncbi.nlm.nih.gov/pub-101',
    isOpenAccess: true,
    citationCount: 65,
  },
  {
    id: 'pub-102',
    source: 'pubmed',
    title: 'Open educational resources with gamified analytics dashboards',
    authors: ['I. Espinoza', 'F. Rivas'],
    year: 2021,
    abstract:
      'Estudia cómo dashboards gamificados, alimentados por IA, ayudan a monitorear progreso y prevenir deserción en carreras STEM.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/pub-102',
    isOpenAccess: false,
  },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL?.replace(/\/$/, '') ?? ''
const hasProxy = Boolean(PROXY_BASE_URL)
const RESULT_LIMIT = 100

type ProxyListResponse = {
  items?: Array<Partial<ExternalPaper> & Record<string, unknown>>
}

const sanitizePaper = (paper: Partial<ExternalPaper>): ExternalPaper => ({
  id: paper.id ?? crypto.randomUUID(),
  source: (paper.source ?? 'semantic_scholar') as ExternalSource,
  title: paper.title ?? 'Título no disponible',
  authors: Array.isArray(paper.authors) && paper.authors.length > 0 ? (paper.authors as string[]) : ['Autor no registrado'],
  year: typeof paper.year === 'number' && !Number.isNaN(paper.year) ? paper.year : new Date().getFullYear(),
  abstract:
    typeof paper.abstract === 'string' && paper.abstract.trim().length > 0
      ? paper.abstract.trim()
      : 'Resumen no disponible para este registro.',
  doi: paper.doi ?? undefined,
  url: paper.url ?? '#',
  isOpenAccess: Boolean(paper.isOpenAccess),
  citationCount: typeof paper.citationCount === 'number' ? paper.citationCount : undefined,
})

const proxyGet = async <T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> => {
  if (!hasProxy) {
    throw new Error('Proxy base URL is not configured')
  }

  const query = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, String(value))
    }
  })

  const url = `${PROXY_BASE_URL}${path}${query.toString() ? `?${query.toString()}` : ''}`
  const response = await fetch(url)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Proxy request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as T
}

const fetchPubMed = async (query: string) => {
  const data = await proxyGet<ProxyListResponse>('/pubmed/search', { q: query, limit: RESULT_LIMIT })
  return (data.items ?? []).map((item) =>
    sanitizePaper({
      ...item,
      source: 'pubmed',
      abstract: item.abstract ?? `Registro PubMed relacionado con "${query}".`,
    }),
  )
}

const fetchSemanticScholar = async (query: string) => {
  const data = await proxyGet<ProxyListResponse>('/semantic-scholar/search', { q: query, limit: RESULT_LIMIT })
  return (data.items ?? []).map((item) => sanitizePaper({ ...item, source: 'semantic_scholar' }))
}

const fetchCrossRef = async (query: string) => {
  const data = await proxyGet<ProxyListResponse>('/crossref/search', { q: query, rows: RESULT_LIMIT })
  return (data.items ?? []).map((item) => sanitizePaper({ ...item, source: 'crossref' }))
}

const fetchEuropePMC = async (query: string) => {
  const data = await proxyGet<ProxyListResponse>('/europe-pmc/search', { q: query, pageSize: RESULT_LIMIT })
  return (data.items ?? []).map((item) => sanitizePaper({ ...item, source: 'europe_pmc' }))
}

const sourceFetchers: Record<ExternalSource, (query: string) => Promise<ExternalPaper[]>> = {
  semantic_scholar: fetchSemanticScholar,
  pubmed: fetchPubMed,
  crossref: fetchCrossRef,
  europe_pmc: fetchEuropePMC,
}

export const searchFederated = async (query: string, databases: ExternalSource[]): Promise<ExternalPaper[]> => {
  const sanitizedQuery = query.trim()
  if (!sanitizedQuery) return []

  if (!hasProxy) {
    await delay(1500)
    const lowered = sanitizedQuery.toLowerCase()
    return mockPapers
      .filter((paper) => databases.includes(paper.source))
      .map((paper) => ({
        ...paper,
        title: `${paper.title} · ${lowered.includes('gamification') ? 'Gamification' : sanitizedQuery}`,
      }))
  }

  const tasks = databases.map(async (source) => {
    try {
      return await sourceFetchers[source](sanitizedQuery)
    } catch (error) {
      console.error(`searchFederated:${source}`, error)
      return []
    }
  })

  const results = await Promise.all(tasks)
  return results.flat()
}

export const searchDatabase = async (source: ExternalSource, query: string): Promise<ExternalPaper[]> => {
  const sanitizedQuery = query.trim()
  if (!sanitizedQuery) return []

  if (!hasProxy) {
    await delay(800)
    return mockPapers.filter((paper) => paper.source === source)
  }

  const fetcher = sourceFetchers[source]
  if (!fetcher) return []

  try {
    return await fetcher(sanitizedQuery)
  } catch (error) {
    console.error(`searchDatabase:${source}`, error)
    return []
  }
}

const proxyPost = async <T>(path: string, body: unknown): Promise<T> => {
  if (!hasProxy) {
    throw new Error('Proxy base URL is not configured')
  }

  const response = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Proxy request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as T
}

const SAMPLE_KEYWORD_MATRIX: KeywordDerivation[] = [
  {
    component: 'P',
    concept: 'Evaluación argumentativa',
    terms: [
      '"argument evaluation"',
      '"argumentation analysis"',
      '"argument mining"',
      '"argument quality assessment"',
      '"argument structure detection"',
    ],
  },
  {
    component: 'I',
    concept: 'LLMs y procesamiento semántico',
    terms: [
      '"large language model"',
      'LLM',
      '"transformer model"',
      'BERT',
      'GPT',
      '"semantic analysis"',
      '"deep contextual embedding"',
    ],
  },
  {
    component: 'C',
    concept: 'Métodos tradicionales de PLN',
    terms: [
      '"traditional NLP"',
      '"rule-based system"',
      '"supervised learning"',
      '"machine learning baseline"',
      '"non-contextual embedding"',
      'Word2Vec',
      'GloVe',
    ],
  },
  {
    component: 'O',
    concept: 'Desempeño en evaluación argumentativa',
    terms: ['accuracy', 'validity', 'reliability', 'performance', 'interpretability', '"evaluation metrics"'],
  },
]

const buildDatabaseStrategies = (keywords: string[]): DatabaseStrategy[] => [
  {
    database: 'PubMed',
    query: `(${keywords.join(' OR ')}) AND ("large language model" OR GPT OR BERT)`,
    filters: 'Últimos 5 años · Estudios revisados por pares · Idioma: inglés',
    estimatedResults: '40-60 registros',
  },
  {
    database: 'Semantic Scholar',
    query: `(${keywords.join(' OR ')}) AND ("transformer model" OR "semantic analysis")`,
    filters: 'Computer Science · Education · Fecha ≥ 2020',
    estimatedResults: '55-80 registros',
  },
  {
    database: 'CrossRef',
    query: `title:(${keywords[0] ?? ''}) AND abstract:("deep contextual embedding" OR "evaluation metrics")`,
    filters: 'Article OR Proceeding · DOI obligatorio',
    estimatedResults: '70-100 registros',
  },
  {
    database: 'Europe PMC',
    query: `(${keywords.join(' OR ')}) AND ("evaluation metrics" OR accuracy OR validity)`,
    filters: 'Open Access · 2020-2025',
    estimatedResults: '25-45 registros',
  },
]

const SAMPLE_STRATEGY: Phase2Strategy = {
  question: '¿Cómo impactan los modelos de lenguaje grandes en la evaluación automática de la argumentación?',
  keywordMatrix: SAMPLE_KEYWORD_MATRIX,
  subquestionStrategies: [
    {
      subquestion: '¿Cómo se comparan los LLM con métodos tradicionales para detectar falacias?',
      keywords: ['"fallacy detection"', '"argument flaw"', '"logical fallacy"'],
      databaseStrategies: buildDatabaseStrategies(['"fallacy detection"', '"argument flaw"', '"logical fallacy"']),
    },
    {
      subquestion: '¿Qué métricas usan los LLM para evaluar la calidad argumentativa?',
      keywords: ['"argument quality metrics"', '"argument scoring"', '"argument evaluation metric"'],
      databaseStrategies: buildDatabaseStrategies([
        '"argument quality metrics"',
        '"argument scoring"',
        '"argument evaluation metric"',
      ]),
    },
    {
      subquestion: '¿En qué dominios se aplican los LLM para análisis argumentativo educativo?',
      keywords: ['"educational argumentation"', '"learning analytics argumentation"', '"argument mining education"'],
      databaseStrategies: buildDatabaseStrategies([
        '"educational argumentation"',
        '"learning analytics argumentation"',
        '"argument mining education"',
      ]),
    },
  ],
  recommendations: [
    'Utiliza las subpreguntas derivadas para crear bloques adicionales (AND) cuando necesites especificar dominio: educativo, legal o debates.',
    'Combina los términos del componente C solo cuando busques comparaciones directas; para estudios de caso puro, omítelos para ampliar el recall.',
    'Revisa cada 3 meses nuevos términos MeSH y actualiza el bloque P con vocabulario controlado (p.ej., "Argumentation" [MeSH]).',
  ],
}

export const generatePhase2Strategy = async (
  phase1: Phase1Data,
  topic: string,
  sources?: ExternalSource[],
): Promise<Phase2Strategy> => {
  const sanitizedTopic = topic.trim() || 'Revisión sistemática en IA educativa'

  if (!hasProxy) {
    await delay(800)
    return SAMPLE_STRATEGY
  }

  try {
    return await proxyPost<Phase2Strategy>('/groq/search-strategy', {
      topic: sanitizedTopic,
      phase1,
      sources,
    })
  } catch (error) {
    console.error('generatePhase2Strategy error', error)
    return SAMPLE_STRATEGY
  }
}

// Backwards compatibility while components migrate to the new API name.
export const generateSearchStrategies = generatePhase2Strategy
