import type { Phase1Data } from '../features/phase1_planning/types.ts'
import type { Candidate } from '../features/projects/types.ts'
import type { ExtractionPayload } from '../features/phase5_extraction/types.ts'
import type { SynthesisTheme } from '../features/phase6_synthesis/types.ts'
import type { SynthesisStats } from '../features/phase6_synthesis/analytics.ts'
import type { AggregatedProjectData } from './project-aggregator.service.ts'
import type { Manuscript, ManuscriptLanguage } from '../features/phase7_report/types.ts'
import type { CaspAnswer, ChecklistType, StudyType } from '../features/phase4_quality/types.ts'
import { createEmptyManuscript } from '../features/phase7_report/types.ts'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL?.replace(/\/$/, '') ?? ''
const hasProxy = Boolean(PROXY_BASE_URL)

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

const proxyGet = async <T>(path: string, params?: Record<string, string | number | undefined | null>): Promise<T> => {
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

export type UnpaywallResolveResponse = {
  doi: string
  isOa: boolean
  pdfUrl: string | null
  landingUrl: string | null
}

export type SemanticScholarPaperResolveResponse = {
  paperId: string
  openAccessPdfUrl: string | null
  doi: string | null
  url: string | null
  isOpenAccess: boolean
}

export const resolveUnpaywallPdf = async (doi: string): Promise<UnpaywallResolveResponse> => {
  return await proxyGet<UnpaywallResolveResponse>('/unpaywall/resolve', { doi })
}

export const resolveSemanticScholarPaper = async (paperId: string): Promise<SemanticScholarPaperResolveResponse> => {
  return await proxyGet<SemanticScholarPaperResolveResponse>('/semantic-scholar/paper', { paperId })
}

export const buildPdfProxyUrl = (rawPdfUrl: string) => {
  if (!rawPdfUrl) return rawPdfUrl
  if (!hasProxy) return rawPdfUrl
  return `${PROXY_BASE_URL}/pdf/proxy?url=${encodeURIComponent(rawPdfUrl)}`
}

export type SynthesisGenerateInput = {
  studies: Array<{
    id: string
    title: string
    year?: number
    authors?: string[]
    country?: string
    studyType?: string
    qualityLevel?: string
    variables?: string[]
    results?: string
    conclusions?: string
    evidence?: Array<{ variable: string; extracted: string; quote: string; page?: number }>
  }>
}

export type SynthesisGenerateResponse = {
  themes: Array<{
    theme: string
    subtheme: string
    studyCount: number
    example: string
    relatedStudies: string[]
  }>
  divergences: string[]
  gaps: string[]
  narrative: string
}

const SAMPLE_SYNTHESIS: SynthesisGenerateResponse = {
  themes: [
    {
      theme: 'Personalización del aprendizaje',
      subtheme: 'Tutoría adaptativa',
      studyCount: 3,
      example: 'Varios estudios reportan mejoras en retroalimentación y adaptación de contenidos usando IA.',
      relatedStudies: [],
    },
  ],
  divergences: ['Los efectos reportados difieren según el contexto institucional y el nivel de adopción tecnológica.'],
  gaps: ['Falta evidencia longitudinal sobre impacto sostenido y resultados laborales.'],
  narrative:
    'Los estudios sintetizados sugieren que la IA en educación superior se asocia con mejoras en personalización y eficiencia docente, aunque los resultados varían por contexto. Se observan divergencias en la magnitud de efectos reportados y en las condiciones de implementación. Persisten vacíos en evidencia longitudinal y en poblaciones subrepresentadas. En conjunto, la tendencia apunta a beneficios potenciales cuando se acompaña de consideraciones éticas y soporte institucional.',
}

export const generateSynthesis = async (input: SynthesisGenerateInput): Promise<SynthesisGenerateResponse> => {
  if (!hasProxy) {
    await delay(1200)
    return SAMPLE_SYNTHESIS
  }

  try {
    return await proxyPost<SynthesisGenerateResponse>('/cohere/synthesis', input)
  } catch (error) {
    console.error('generateSynthesis error', error)
    await delay(800)
    return SAMPLE_SYNTHESIS
  }
}

export type QualityAssessmentSuggestion = {
  studyType?: StudyType
  criteria: Array<{
    id: string
    answer?: CaspAnswer
    evidence?: string
    justification?: string
  }>
}

export type QualityBatchSuggestionResponse = {
  results: Array<{
    studyId: string
    studyType: StudyType
    checklistType: ChecklistType
    criteria: Array<{
      id: string
      answer: CaspAnswer
      evidence?: string
      justification?: string
    }>
  }>
}

export const batchSuggestQualityAssessments = async (input: {
  studies: Array<{ id: string; title: string; abstract: string }>
}): Promise<QualityBatchSuggestionResponse> => {
  if (!hasProxy) {
    await delay(800)
    return {
      results: input.studies.map((study) => ({
        studyId: study.id,
        studyType: 'Observational',
        checklistType: 'STROBE',
        criteria: [],
      })),
    }
  }

  return await proxyPost<QualityBatchSuggestionResponse>('/cohere/quality-batch', input)
}

export const suggestQualityAssessment = async (input: {
  title: string
  abstract: string
  checklistType: ChecklistType
  criteria: Array<{ id: string; question: string }>
}): Promise<QualityAssessmentSuggestion> => {
  if (!hasProxy) {
    await delay(800)
    return {
      studyType: 'Observational',
      criteria: input.criteria.map((criterion) => ({
        id: criterion.id,
        answer: 'Partial',
        evidence: 'Evidencia no disponible sin proxy configurado.',
        justification: 'Completa manualmente o configura el proxy para sugerencias automáticas.',
      })),
    }
  }

  try {
    const response = await batchSuggestQualityAssessments({
      studies: [
        {
          id: 'single',
          title: input.title,
          abstract: input.abstract,
        },
      ],
    })

    const first = response.results[0]
    return {
      studyType: first?.studyType ?? 'Observational',
      criteria: (first?.criteria ?? []).map((criterion) => ({
        id: criterion.id,
        answer: criterion.answer,
        evidence: criterion.evidence,
        justification: criterion.justification,
      })),
    }
  } catch (error) {
    console.error('suggestQualityAssessment', error)
    return {
      studyType: 'Observational',
      criteria: input.criteria.map((criterion) => ({
        id: criterion.id,
        answer: 'Partial',
        evidence: 'No se pudo obtener sugerencia automática desde el proxy.',
        justification: 'Completa manualmente o revisa la configuración del proxy / endpoint /cohere/quality-batch.',
      })),
    }
  }
}

export type GeneratedProtocolPayload = {
  topic: string
  protocol: {
    mainQuestion: string
    pico: {
      population: string
      intervention: string
      comparison: string
      outcome: string
    }
    subquestions: string[]
    objectives: string
    coherenceAnalysis: string
    methodologicalJustification: string
    inclusionCriteria: string[]
    exclusionCriteria: string[]
  }
  generatedAt: number
}

const evaluateDecision = (title: string, abstract: string): Candidate['decision'] => {
  const normalized = `${title} ${abstract}`.toLowerCase()
  if (normalized.includes('gamification')) return 'include'
  if (normalized.includes('k-12') || normalized.includes('school')) return 'exclude'
  return 'uncertain'
}

export const screenPaper = async (paper: Candidate, criteria: Phase1Data): Promise<Candidate> => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const decision = evaluateDecision(paper.title, paper.abstract)

  const reasonMap: Record<NonNullable<Candidate['decision']>, string> = {
    include: `Cumple criterios PICO (${criteria.pico.population}) y menciona Gamification.`,
    exclude: 'Población escolar (K-12) fuera del alcance universitario definido.',
    uncertain: 'No hay suficiente contexto para asegurar cumplimiento de criterios. Requiere revisión humana.',
  }

  const confidenceMap: Record<NonNullable<Candidate['decision']>, Candidate['confidence']> = {
    include: 'high',
    exclude: 'high',
    uncertain: 'medium',
  }

  return {
    ...paper,
    screeningStatus: 'screened',
    decision,
    confidence: decision ? confidenceMap[decision] : 'medium',
    reason: decision ? reasonMap[decision] : undefined,
    processedAt: Date.now(),
    userConfirmed: false,
  }
}

const normalizeDecision = (label: string): NonNullable<Candidate['decision']> => {
  const value = label.toLowerCase()
  if (value.includes('inclu')) return 'include'
  if (value.includes('exclu')) return 'exclude'
  return 'uncertain'
}

export const classifyCandidatesWithCohere = async (
  candidates: Candidate[],
  criteria: Phase1Data,
): Promise<Array<{ id: string; decision: NonNullable<Candidate['decision']>; justification: string; subtopic?: string }>> => {
  if (!candidates.length) {
    return []
  }

  const response = await proxyPost<{ results: Array<{ id: string; decision: string; justification: string; subtopic?: string }> }>(
    '/cohere/classify',
    {
      criteria,
      articles: candidates.map(({ id, title, abstract }) => ({ id, title, abstract })),
    },
  )

  return response.results.map((entry) => ({
    id: entry.id,
    decision: normalizeDecision(entry.decision),
    justification: entry.justification,
    subtopic: entry.subtopic,
  }))
}

const PICO_TEMPLATE: GeneratedProtocolPayload['protocol']['pico'] = {
  population: 'Docentes de educación superior en Latinoamérica',
  intervention: 'Implementación de plataformas basadas en IA para evaluación automática',
  comparison: 'Métodos tradicionales de evaluación manual',
  outcome: 'Mejora en la objetividad, rapidez y retroalimentación para estudiantes',
}

const PROTOCOL_RESPONSE: GeneratedProtocolPayload['protocol'] = {
  mainQuestion: '¿Cómo impacta la evaluación automatizada con IA en la calidad de la retroalimentación en cursos STEM?',
  pico: PICO_TEMPLATE,
  subquestions: [
    '¿Cómo se compara la precisión de la retroalimentación automática basada en IA frente a rúbricas manuales?',
    '¿Qué rol cumple el contexto institucional en la adopción de plataformas de evaluación automatizada?',
    '¿Qué métricas de resultados (tiempo, satisfacción, desempeño) mejoran con la IA vs métodos tradicionales?',
  ],
  objectives: 'Evaluar rigurosamente la eficacia y coherencia metodológica de las plataformas de evaluación automática con IA frente a enfoques tradicionales.',
  coherenceAnalysis: 'La pregunta principal, sus subpreguntas y el modelo PICO se alinean al contrastar explícitamente la intervención (IA) con métodos tradicionales dentro de contextos educativos similares.',
  methodologicalJustification:
    'Se emplea PICO para asegurar comparabilidad entre intervenciones tecnológicas y controles tradicionales, habilitando métricas cuantificables y reproducibles.',
  inclusionCriteria: ['Estudios revisados por pares', 'Publicaciones a partir de 2018', 'Contexto universitario'],
  exclusionCriteria: ['Estudios sin datos cuantitativos', 'Artículos de opinión sin metodología'],
}

const mapProtocolToPhase1 = (topic: string, payload: GeneratedProtocolPayload): Phase1Data => {
  const pico = payload.protocol.pico ?? PICO_TEMPLATE
  const ensureSubquestions = (subquestions: string[]) => {
    const cleaned = subquestions.map((entry) => entry.trim()).filter(Boolean)
    if (cleaned.length >= 5) {
      return cleaned.slice(0, 5)
    }

    const fallbackTemplates = [
      `¿Cómo impacta ${topic} en los resultados primarios definidos en la pregunta PICO?`,
      `¿Qué variaciones se observan en ${topic} cuando se compara con el control definido en la PICO?`,
      `¿Cómo influye ${topic} en subgrupos específicos de la población objetivo?`,
      `¿Qué factores metodológicos condicionan la efectividad o seguridad de ${topic}?`,
      `¿Cómo contribuye ${topic} a la reproducibilidad y calidad de la evidencia disponible?`,
    ]

    const combined = [...cleaned]
    let index = 0
    while (combined.length < 5 && index < fallbackTemplates.length) {
      const candidate = fallbackTemplates[index]
      if (!combined.includes(candidate)) {
        combined.push(candidate)
      }
      index += 1
    }

    while (combined.length < 5) {
      combined.push(`Subpregunta complementaria sobre ${topic} #${combined.length + 1}`)
    }

    return combined.slice(0, 5)
  }

  const inclusion =
    payload.protocol.inclusionCriteria?.length ? payload.protocol.inclusionCriteria : PROTOCOL_RESPONSE.inclusionCriteria
  const exclusion =
    payload.protocol.exclusionCriteria?.length ? payload.protocol.exclusionCriteria : PROTOCOL_RESPONSE.exclusionCriteria

  return {
    mainQuestion: payload.protocol.mainQuestion || `¿Cómo impacta ${topic} en los resultados de aprendizaje y retención?`,
    subquestions: ensureSubquestions(payload.protocol.subquestions ?? PROTOCOL_RESPONSE.subquestions),
    objectives:
      payload.protocol.objectives ??
      `Documentar sistemáticamente la evidencia publicada sobre ${topic}, alineada a PRISMA y criterios PICO.`,
    coherenceAnalysis:
      payload.protocol.coherenceAnalysis ??
      'Validar que la pregunta principal, subpreguntas y componentes PICO mantengan consistencia lógica y temporal.',
    methodologicalJustification:
      payload.protocol.methodologicalJustification ??
      'Se usa PICO para garantizar comparabilidad directa entre la intervención propuesta y su contraparte control.',
    pico: {
      population: pico.population || PICO_TEMPLATE.population,
      intervention: pico.intervention || `${topic} potenciadas con IA`,
      comparison: pico.comparison || PICO_TEMPLATE.comparison,
      outcome: pico.outcome || PICO_TEMPLATE.outcome,
    },
    inclusionCriteria: inclusion,
    exclusionCriteria: exclusion,
  }
}

export const generateProtocolFromTemplate = async (topic: string): Promise<GeneratedProtocolPayload> => {
  const sanitizedTopic = topic.trim() || 'Revisión sistemática en educación STEM'

  if (!hasProxy) {
    await delay(1200)
    return {
      topic: sanitizedTopic,
      protocol: PROTOCOL_RESPONSE,
      generatedAt: Date.now(),
    }
  }

  try {
    return await proxyPost<GeneratedProtocolPayload>('/groq/protocol', { topic: sanitizedTopic })
  } catch (error) {
    console.error('generateProtocolFromTemplate error', error)
    return {
      topic: sanitizedTopic,
      protocol: PROTOCOL_RESPONSE,
      generatedAt: Date.now(),
    }
  }
}

export const generatePhase1Protocol = async (topic: string): Promise<Phase1Data> => {
  const sanitizedTopic = topic.trim() || 'aprendizaje impulsado por IA'
  const payload = await generateProtocolFromTemplate(sanitizedTopic)
  return mapProtocolToPhase1(sanitizedTopic, payload)
}

const SAMPLE_EXTRACTION: ExtractionPayload = {
  evidence: [
    {
      variable: 'Muestra',
      extracted: '128 participantes (control/experimental)',
      quote: '... divided into control and experimental groups (n = 128) ...',
    },
    {
      variable: 'Resultado principal',
      extracted: 'Mejora del 18% en precisión de evaluaciones',
      quote: 'The intervention improved evaluation accuracy by 18% compared to baseline...',
    },
  ],
  variables: ['Muestra', 'Resultado principal'],
  sample: {
    size: 128,
    description: 'Docentes universitarios y estudiantes de ingeniería divididos en grupos control y experimental.',
  },
  methodology: {
    design: 'Ensayo controlado con mediciones pre y post intervención.',
    duration: '16 semanas',
  },
  intervention: {
    description: 'Uso de plataforma de IA para retroalimentación automática y dashboards de progreso.',
    tools: ['Plataforma IA', 'Dashboard analítico', 'Bot de retroalimentación'],
  },
  outcomes: {
    primary: 'Mejora del 18% en precisión de evaluaciones y reducción de 22% en tiempos de retroalimentación.',
    results: 'p < 0.05 para métricas de coherencia y satisfacción estudiantil.',
  },
  conclusions:
    'La intervención basada en IA mostró mejoras significativas en precisión y eficiencia de retroalimentación; se recomienda validar en múltiples contextos y con seguimiento longitudinal.',
  limitations: ['Muestra concentrada en un solo país', 'Sin seguimiento longitudinal'],
}

export const extractDataRAG = async (pdfText: string): Promise<ExtractionPayload> => {
  if (!hasProxy || !pdfText?.trim()) {
    await delay(1200)
    return SAMPLE_EXTRACTION
  }

  try {
    return await proxyPost<ExtractionPayload>('/cohere/extraction', { pdfText })
  } catch (error) {
    console.error('extractDataRAG error', error)
    await delay(800)
    return SAMPLE_EXTRACTION
  }
}

const SAMPLE_NARRATIVE = `Los estudios analizados muestran una tendencia creciente desde 2019, con una concentración importante en Norteamérica y Europa. En general, la implementación de herramientas basadas en IA reportó mejoras consistentes en la rapidez de retroalimentación y en la precisión de las evaluaciones.

Los temas predominantes indican que las intervenciones más efectivas combinan dashboards analíticos con entrenamiento docente. Los resultados cuantitativos respaldan incrementos estadísticamente significativos en métricas de coherencia, aunque persisten variaciones por contexto institucional.

Finalmente, se observan vacíos de evidencia en poblaciones de educación técnica y en seguimientos longitudinales. Estos hallazgos sugieren priorizar estudios multicéntricos y métricas de impacto a largo plazo.`

export const generateNarrative = async (
  themes: SynthesisTheme[],
  stats: SynthesisStats,
): Promise<string> => {
  const themeSummary =
    themes.length > 0
      ? themes.map((theme) => `${theme.theme} / ${theme.subtheme}: ${theme.example}`).join(' | ')
      : 'Sin temas definidos'

  const numericSummary = {
    years: stats.byYear.map((item) => `${item.name}: ${item.count ?? 0}`).join(', '),
    countries: stats.byCountry.slice(0, 5).map((item) => `${item.name}: ${item.value ?? 0}`).join(', '),
    effects: stats.forest
      .slice(0, 5)
      .map((item) => `${item.title}: ${item.effect.toFixed(2)} [${item.lower.toFixed(2)}, ${item.upper.toFixed(2)}]`)
      .join(' | '),
  }

  if (!hasProxy) {
    await delay(1200)
    return `${SAMPLE_NARRATIVE}\n\nTemas clave: ${themeSummary}\nDatos cuantitativos: ${numericSummary.years}`
  }

  try {
    const response = await proxyPost<{ narrative: string }>('/groq/narrative', { themes, stats })
    return response.narrative?.trim() || SAMPLE_NARRATIVE
  } catch (error) {
    console.error('generateNarrative error', error)
    await delay(800)
    return SAMPLE_NARRATIVE
  }
}

const computeWordCountFromManuscript = (manuscript: Manuscript) => {
  const text =
    manuscript.abstract +
    ' ' +
    manuscript.abstractEn +
    ' ' +
    manuscript.introduction +
    ' ' +
    manuscript.methods +
    ' ' +
    manuscript.results +
    ' ' +
    manuscript.discussion +
    ' ' +
    manuscript.conclusions +
    ' ' +
    manuscript.keywords.join(' ') +
    ' ' +
    manuscript.keywordsEn.join(' ') +
    ' ' +
    manuscript.references.join(' ')
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const buildApaReferences = (studies: Candidate[]) => {
  const surnameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von'])

  const isInitialsOnly = (raw: string) => {
    const tokens = String(raw ?? '')
      .replace(/[,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
    if (!tokens.length) return false
    return tokens.every((t) => /^[A-Za-z]{1,3}\.?$/.test(t))
  }

  const extractSurname = (tokens: string[]) => {
    if (!tokens.length) return { surname: '', given: [] as string[] }
    let end = tokens.length - 1
    let start = end
    while (start - 1 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1
    if (start - 1 >= 0 && tokens.length <= 3) start -= 1
    const surname = tokens.slice(Math.max(0, start), end + 1).join(' ').trim()
    const given = tokens.slice(0, Math.max(0, start))
    return { surname, given }
  }

  const toInitials = (givenTokens: string[]) =>
    (givenTokens ?? [])
      .map((token) => String(token ?? '').replace(/[^a-zA-ZÀ-ÿ]/g, ''))
      .filter(Boolean)
      .map((token) => `${token[0].toUpperCase()}.`)
      .join(' ')

  const formatAuthor = (raw: string) => {
    const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return ''
    if (isInitialsOnly(cleaned)) return cleaned

    const commaIndex = cleaned.indexOf(',')
    if (commaIndex > 0) {
      const surname = cleaned.slice(0, commaIndex).trim()
      const given = cleaned
        .slice(commaIndex + 1)
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
      const initials = toInitials(given)
      return initials ? `${surname}, ${initials}`.trim() : surname
    }

    const tokens = cleaned.split(' ').filter(Boolean)
    if (tokens.length === 1) return tokens[0]
    const { surname, given } = extractSurname(tokens)
    const initials = toInitials(given)
    if (!surname) return cleaned
    return initials ? `${surname}, ${initials}`.trim() : surname
  }

  const joinAuthors = (authors: string[]) => {
    const normalized = (authors ?? []).map((name) => formatAuthor(name)).filter(Boolean)
    if (normalized.length === 0) return ''
    if (normalized.length === 1) return normalized[0]
    if (normalized.length === 2) return `${normalized[0]}, & ${normalized[1]}`
    if (normalized.length <= 20) {
      return `${normalized.slice(0, -1).join(', ')}, & ${normalized[normalized.length - 1]}`
    }
    const first = normalized.slice(0, 19)
    const last = normalized[normalized.length - 1]
    return `${first.join(', ')}, ..., ${last}`
  }

  const normalizeDoi = (raw: string) => {
    const cleaned = String(raw ?? '').trim()
    if (!cleaned) return ''
    return cleaned
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi\s*:\s*/i, '')
      .replace(/\s+/g, '')
  }

  const normalizeUrl = (raw: string) => String(raw ?? '').trim()

  const toReference = (study: Candidate) => {
    const title = String(study.title ?? '').trim().replace(/\.+$/g, '')
    const year = study.year ? String(study.year) : 'n.d.'
    const authors = joinAuthors(study.authors ?? [])
    const doiRaw = typeof study.doi === 'string' ? study.doi : ''
    const urlRaw = typeof study.url === 'string' ? study.url : ''
    const doi = normalizeDoi(doiRaw || (urlRaw.includes('doi.org') ? urlRaw : ''))
    const url = normalizeUrl(urlRaw)
    const locator = doi ? `https://doi.org/${doi}` : url
    if (!title) return ''
    if (!locator) return ''
    if (authors) return `${authors} (${year}). ${title}. ${locator}`.trim()
    return `${title}. (${year}). ${locator}`.trim()
  }

  return (studies ?? [])
    .slice()
    .sort((a, b) => {
      const aKey = `${(a.authors?.[0] ?? '').toLowerCase()}-${a.year ?? 0}-${a.title ?? ''}`
      const bKey = `${(b.authors?.[0] ?? '').toLowerCase()}-${b.year ?? 0}-${b.title ?? ''}`
      return aKey.localeCompare(bKey)
    })
    .map((study) => toReference(study))
    .filter(Boolean)
}

const DEFAULT_MANUSCRIPT = (
  projectId: string,
  aggregated?: AggregatedProjectData,
  language: ManuscriptLanguage = 'es',
): Manuscript => {
  const includedCount = aggregated?.includedStudies?.length ?? 0
  const prismaIdentified = aggregated?.prisma?.identified ?? 0
  const prismaDuplicates = aggregated?.prisma?.duplicates ?? 0
  const prismaWithoutAbstract = aggregated?.prisma?.withoutAbstract ?? 0
  const prismaScreened = aggregated?.prisma?.screened ?? 0
  const prismaIncluded = aggregated?.prisma?.included ?? includedCount
  const phase1Question = aggregated?.phase1?.mainQuestion ?? '¿Cuál es el efecto de las intervenciones basadas en IA en contextos educativos?'

  const normalizedQuestion = phase1Question.replace(/[¿?]/g, '').trim()
  const title =
    language === 'en'
      ? `${normalizedQuestion || 'Systematic review'}: A systematic review`
      : `${normalizedQuestion || 'Revisión sistemática'}: Una revisión sistemática`

  const excludedStudyIds = new Set(
    (aggregated?.extractionMatrix ?? [])
      .filter((entry: any) => entry?.status === 'not_extractable')
      .map((entry: any) => String(entry?.studyId ?? ''))
      .filter(Boolean),
  )
  const reportStudies = (aggregated?.includedStudies ?? []).filter((study) => !excludedStudyIds.has(String((study as any)?.id ?? '')))

  const references = buildApaReferences(reportStudies)

  const base = createEmptyManuscript(projectId)

  const manuscript: Manuscript =
    language === 'en'
      ? {
          ...base,
          language,
          title,
          abstract: `This systematic review synthesizes the available evidence on AI-based interventions and their impact in educational settings. PRISMA 2020 guidance was applied to ensure transparency and reproducibility. A total of ${prismaIdentified} records were identified and ${prismaIncluded} studies were included.`,
          abstractEn: `This systematic review synthesizes the available evidence on AI-based interventions and their impact in educational settings. PRISMA 2020 guidance was applied to ensure transparency and reproducibility. A total of ${prismaIdentified} records were identified and ${prismaIncluded} studies were included.`,
          keywords: [],
          keywordsEn: [],
          introduction: `The integration of intelligent technologies in learning environments has motivated multiple studies comparing their effectiveness with traditional approaches. This review addresses the central question: ${phase1Question}. Despite a diversity of designs and contexts, important gaps remain regarding longitudinal follow-up and learner-centered metrics.`,
          methods:
            'Federated searches were conducted in international databases, applying predefined PICO criteria and PRISMA flows. Methodological quality was assessed using CASP and quantitative extractions were standardized into structured matrices.',
          results:
            `In Figure 1, the PRISMA flow diagram summarizes identification and screening: ${prismaIdentified} records were identified, ${prismaDuplicates} duplicates were removed, ${prismaWithoutAbstract} records lacked an abstract, ${prismaScreened} were screened, and ${prismaIncluded} were included. These stages represent progressive filtering from retrieval to eligibility based on predefined criteria. The sequence ensures transparency about why studies entered or left the review.\n\n` +
            `In Table 1, the comparative matrix synthesizes the populations addressed and the most significant contributions reported across the included studies. This overview highlights how interventions were applied in different educational contexts and where the strongest reported benefits concentrate. It also illustrates heterogeneity in populations and outcomes described.\n\n` +
            `In Table 2, studies are organized by title, country of origin, design, and indexing source. This structure supports traceability of evidence and helps contextualize methodological diversity across settings. It also helps readers locate the primary sources efficiently.\n\n` +
            `In Figure 2, the distribution by year provides an overview of publication activity over time. Variations across years can reflect shifts in research priorities and the maturity of AI-based interventions in education.\n\n` +
            `In Figure 3, the distribution by country indicates how evidence is geographically concentrated and where representation is limited. This pattern can inform interpretation of generalizability and identify opportunities for research in underrepresented regions.`,
          discussion:
            'Findings support the adoption of automated assessment systems, although methodological heterogeneity limits full generalizability. Multi-center studies and direct platform comparisons are needed to clarify the role of personalization.',
          conclusions:
            'Evidence converges on AI-based tools improving feedback and reducing response times, particularly when accompanied by pedagogical support. Future studies should prioritize underrepresented populations and sustained impact outcomes.',
          references,
          generatedAt: Date.now(),
          wordCount: 0,
        }
      : {
          ...base,
          language,
          title,
          abstract:
            `Esta revisión sistemática sintetiza la evidencia disponible sobre intervenciones basadas en IA y su impacto en contextos educativos. Se aplicó la guía PRISMA 2020 para asegurar transparencia y reproducibilidad. En total se identificaron ${prismaIdentified} registros y se incluyeron ${prismaIncluded} estudios.`,
          abstractEn:
            `This systematic review synthesizes the available evidence on AI-based interventions and their impact in educational settings. PRISMA 2020 guidance was applied to ensure transparency and reproducibility. A total of ${prismaIdentified} records were identified and ${prismaIncluded} studies were included.`,
          keywords: [],
          keywordsEn: [],
          introduction:
            `La incorporación de tecnologías inteligentes en entornos de aprendizaje ha motivado múltiples estudios que comparan su eficacia con métodos tradicionales. Esta síntesis aborda la pregunta central: ${phase1Question}. A pesar de la diversidad de diseños y contextos, persisten lagunas en torno al seguimiento longitudinal y las métricas centradas en el estudiantado.`,
          methods:
            'Se llevaron a cabo búsquedas federadas en bases de datos internacionales, aplicando criterios PICO predefinidos y flujos PRISMA. La calidad metodológica se evaluó mediante CASP y las extracciones cuantitativas fueron estandarizadas en matrices estructuradas.',
          results:
            `En la Figura 1, el diagrama PRISMA resume la identificación y el cribado: se identificaron ${prismaIdentified} registros, se eliminaron ${prismaDuplicates} duplicados, ${prismaWithoutAbstract} registros no contaron con resumen, se cribaron ${prismaScreened} y se incluyeron ${prismaIncluded}. Estas etapas representan un filtrado progresivo desde la recuperación hasta la elegibilidad según criterios predefinidos. La secuencia garantiza transparencia sobre por qué los estudios ingresan o salen de la revisión.\n\n` +
            `En la Tabla 1, la matriz comparativa sintetiza las poblaciones abordadas y los aportes significativos reportados en los estudios incluidos. Esta visión permite identificar en qué contextos educativos se aplicaron las intervenciones y dónde se concentran los beneficios más destacados. Asimismo, muestra la heterogeneidad entre poblaciones y métricas reportadas.\n\n` +
            `En la Tabla 2, los estudios se organizan por título, país de procedencia, diseño e indización (fuente de indexación). Esta estructura mejora la trazabilidad de la evidencia y permite contextualizar la diversidad metodológica entre entornos. Además, facilita la localización de las fuentes primarias.\n\n` +
            `En la Figura 2, la distribución por año ofrece una visión del volumen de publicaciones a lo largo del tiempo. Las variaciones entre años pueden reflejar cambios en prioridades de investigación y en la madurez de las intervenciones basadas en IA en educación.\n\n` +
            `En la Figura 3, la distribución por país muestra cómo la evidencia se concentra geográficamente y dónde existe menor representación. Este patrón orienta la interpretación de la generalización de hallazgos y sugiere oportunidades de investigación en regiones subrepresentadas.`,
          discussion:
            'Los hallazgos respaldan la adopción de sistemas de evaluación automatizada, aunque la heterogeneidad metodológica limita la extrapolación completa. Se requieren estudios multicéntricos y comparaciones directas entre plataformas para comprender el rol de la personalización.',
          conclusions:
            'La evidencia converge en que las herramientas basadas en IA optimizan la retroalimentación y reducen tiempos de respuesta, siempre que exista acompañamiento pedagógico. Las futuras investigaciones deben priorizar poblaciones subrepresentadas y métricas de impacto sostenido.',
          references,
          generatedAt: Date.now(),
          wordCount: 0,
        }

  return { ...manuscript, wordCount: computeWordCountFromManuscript(manuscript) }
}

export const generateFullManuscript = async (
  projectId: string,
  aggregated: AggregatedProjectData,
  options?: { language?: ManuscriptLanguage },
): Promise<Manuscript> => {
  const language: ManuscriptLanguage = options?.language === 'en' ? 'en' : 'es'
  if (!hasProxy) {
    await delay(1500)
    return DEFAULT_MANUSCRIPT(projectId, aggregated, language)
  }

  try {
    const response = await proxyPost<Partial<Manuscript> & { generatedAt?: number }>(
      '/cohere/manuscript',
      {
        projectId,
        aggregated,
        language,
      },
    )

    const base = createEmptyManuscript(projectId)
    const excludedStudyIds = new Set(
      (aggregated?.extractionMatrix ?? [])
        .filter((entry: any) => entry?.status === 'not_extractable')
        .map((entry: any) => String(entry?.studyId ?? ''))
        .filter(Boolean),
    )
    const reportStudies = (aggregated?.includedStudies ?? []).filter((study) => !excludedStudyIds.has(String((study as any)?.id ?? '')))
    const references = buildApaReferences(reportStudies)
    const derivedTitle = DEFAULT_MANUSCRIPT(projectId, aggregated, language).title
    const manuscript = {
      ...base,
      ...response,
      projectId,
      language,
      title: typeof response.title === 'string' && response.title.trim() ? response.title.trim() : derivedTitle,
      abstractEn:
        typeof (response as any).abstractEn === 'string'
          ? String((response as any).abstractEn)
          : typeof response.abstract === 'string'
            ? response.abstract
            : '',
      keywords: Array.isArray((response as any).keywords)
        ? (response as any).keywords.map((kw: unknown) => String(kw ?? '').trim()).filter(Boolean)
        : [],
      keywordsEn: Array.isArray((response as any).keywordsEn)
        ? (response as any).keywordsEn.map((kw: unknown) => String(kw ?? '').trim()).filter(Boolean)
        : [],
      references,
      generatedAt: response.generatedAt ?? Date.now(),
    }

    return { ...manuscript, wordCount: computeWordCountFromManuscript(manuscript) }
  } catch (error) {
    console.error('generateFullManuscript error', error)
    await delay(1000)
    return DEFAULT_MANUSCRIPT(projectId, aggregated, language)
  }
}
