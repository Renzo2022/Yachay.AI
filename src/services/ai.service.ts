import type { Phase1Data } from '../features/phase1_planning/types.ts'
import type { Candidate } from '../features/projects/types.ts'
import type { ExtractionPayload } from '../features/phase5_extraction/types.ts'
import type { SynthesisTheme } from '../features/phase6_synthesis/types.ts'
import type { SynthesisStats } from '../features/phase6_synthesis/analytics.ts'
import type { AggregatedProjectData } from './project-aggregator.service.ts'
import type { Manuscript } from '../features/phase7_report/types.ts'
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

    const defaults = PROTOCOL_RESPONSE.subquestions
    const combined = [...cleaned]
    let index = 0
    while (combined.length < 5 && index < defaults.length) {
      if (!combined.includes(defaults[index])) {
        combined.push(defaults[index])
      }
      index += 1
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
  limitations: ['Muestra concentrada en un solo país', 'Sin seguimiento longitudinal'],
}

export const extractDataRAG = async (pdfText: string): Promise<ExtractionPayload> => {
  if (!hasProxy || !pdfText?.trim()) {
    await delay(1200)
    return SAMPLE_EXTRACTION
  }

  try {
    return await proxyPost<ExtractionPayload>('/groq/extraction', { pdfText })
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
    themes.length > 0 ? themes.map((theme) => `${theme.title}: ${theme.description}`).join(' | ') : 'Sin temas definidos'

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
    manuscript.references.join(' ')
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const DEFAULT_MANUSCRIPT = (projectId: string, aggregated?: AggregatedProjectData): Manuscript => {
  const includedCount = aggregated?.includedStudies?.length ?? 0
  const prismaIdentified = aggregated?.prisma?.identified ?? 0
  const prismaIncluded = aggregated?.prisma?.included ?? includedCount
  const phase1Question = aggregated?.phase1?.mainQuestion ?? '¿Cuál es el efecto de las intervenciones basadas en IA en contextos educativos?'

  const manuscript = {
  ...createEmptyManuscript(projectId),
  abstract:
    `Esta revisión sistemática sintetiza la evidencia disponible sobre intervenciones basadas en IA y su impacto en contextos educativos. Se aplicó la guía PRISMA 2020 para asegurar transparencia y reproducibilidad. En total se identificaron ${prismaIdentified} registros y se incluyeron ${prismaIncluded} estudios.`,
  introduction:
    `La incorporación de tecnologías inteligentes en entornos de aprendizaje ha motivado múltiples estudios que comparan su eficacia con métodos tradicionales. Esta síntesis aborda la pregunta central: ${phase1Question}. A pesar de la diversidad de diseños y contextos, persisten lagunas en torno al seguimiento longitudinal y las métricas centradas en el estudiantado.`,
  methods:
    'Se llevaron a cabo búsquedas federadas en bases de datos internacionales, aplicando criterios PICO predefinidos y flujos PRISMA. La calidad metodológica se evaluó mediante CASP y las extracciones cuantitativas fueron estandarizadas en matrices estructuradas.',
  results:
    `Se incluyeron ${includedCount} estudios con predominio de ensayos controlados y diseños quasi-experimentales. Las intervenciones más efectivas combinaron dashboards analíticos con coaching docente, mostrando mejoras estadísticamente significativas en precisión de retroalimentación.`,
  discussion:
    'Los hallazgos respaldan la adopción de sistemas de evaluación automatizada, aunque la heterogeneidad metodológica limita la extrapolación completa. Se requieren estudios multicéntricos y comparaciones directas entre plataformas para comprender el rol de la personalización.',
  conclusions:
    'La evidencia converge en que las herramientas basadas en IA optimizan la retroalimentación y reducen tiempos de respuesta, siempre que exista acompañamiento pedagógico. Las futuras investigaciones deben priorizar poblaciones subrepresentadas y métricas de impacto sostenido.',
  references: ['PRISMA 2020 Statement', 'CASP Qualitative Checklist'],
  generatedAt: Date.now(),
  wordCount: 0,
  }

  return { ...manuscript, wordCount: computeWordCountFromManuscript(manuscript) }
}

export const generateFullManuscript = async (
  projectId: string,
  aggregated: AggregatedProjectData,
): Promise<Manuscript> => {
  if (!hasProxy) {
    await delay(1500)
    return DEFAULT_MANUSCRIPT(projectId, aggregated)
  }

  try {
    const response = await proxyPost<Partial<Manuscript> & { references?: string[]; generatedAt?: number }>(
      '/groq/manuscript',
      {
        projectId,
        aggregated,
      },
    )

    const base = createEmptyManuscript(projectId)
    const manuscript = {
      ...base,
      ...response,
      projectId,
      references: response.references ?? [],
      generatedAt: response.generatedAt ?? Date.now(),
    }

    return { ...manuscript, wordCount: computeWordCountFromManuscript(manuscript) }
  } catch (error) {
    console.error('generateFullManuscript error', error)
    await delay(1000)
    return DEFAULT_MANUSCRIPT(projectId, aggregated)
  }
}
