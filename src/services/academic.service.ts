import type { ExternalPaper, ExternalSource, SearchStrategy } from '../features/phase2_search/types.ts'

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
const RESULT_LIMIT = 8

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

export const generateSearchStrategies = async (topic: string): Promise<SearchStrategy[]> => {
  await delay(800)
  return [
    {
      database: 'Scopus',
      query: `TITLE-ABS-KEY ( "gamification" AND "${topic}" ) AND ( "systematic review" OR "evidence-based" )`,
      notes: 'Limitar a publicaciones 2019-2025, áreas Medicine OR Computer Science.',
    },
    {
      database: 'Web of Science',
      query: `TS=("gamified learning" NEAR/3 analytics) AND TS=("LLM" OR "large language model") AND TS=(${topic})`,
      notes: 'Filtrar colecciones SCI-EXPANDED y ESCI.',
    },
  ]
}
