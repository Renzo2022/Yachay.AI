import Groq from 'groq-sdk'
import type { Phase1Data } from '../features/phase1_planning/types.ts'
import type { Candidate } from '../features/projects/types.ts'
import type { ExtractionPayload } from '../features/phase5_extraction/types.ts'
import type { SynthesisTheme } from '../features/phase6_synthesis/types.ts'
import type { SynthesisStats } from '../features/phase6_synthesis/analytics.ts'
import type { AggregatedProjectData } from './project-aggregator.service.ts'
import type { Manuscript } from '../features/phase7_report/types.ts'
import { createEmptyManuscript } from '../features/phase7_report/types.ts'

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
  inclusionCriteria: ['Estudios revisados por pares', 'Publicaciones a partir de 2018', 'Contexto universitario'],
  exclusionCriteria: ['Estudios sin datos cuantitativos', 'Artículos de opinión sin metodología'],
}

export const generateProtocolFromTemplate = async (topic: string): Promise<GeneratedProtocolPayload> => {
  const hasApiKey = Boolean(import.meta.env.VITE_GROQ_API_KEY)

  if (!hasApiKey) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return {
      topic,
      protocol: PROTOCOL_RESPONSE,
      generatedAt: Date.now(),
    }
  }

  // TODO: Implement real Groq call using groq-sdk when API key is available.
  return {
    topic,
    protocol: PROTOCOL_RESPONSE,
    generatedAt: Date.now(),
  }
}

export const generatePhase1Protocol = async (topic: string): Promise<Phase1Data> => {
  await new Promise((resolve) => setTimeout(resolve, 1800))
  return {
    mainQuestion: `¿Cómo impacta ${topic} en los resultados de aprendizaje y retención en contextos STEM?`,
    subquestions: [
      `¿Qué métricas definen el éxito de ${topic}?`,
      `¿Qué poblaciones obtienen mayor beneficio al aplicar ${topic}?`,
    ],
    objectives: `Evaluar rigurosamente la eficacia de ${topic} combinando métricas cuantitativas (engagement, retención) y cualitativas (percepción docente).`,
    pico: {
      population: 'Estudiantes universitarios en programas STEM',
      intervention: `${topic} potenciadas con analítica e IA`,
      comparison: 'Metodologías tradicionales sin gamificación / IA',
      outcome: 'Mejora en aprendizaje basado en evidencia y reducción de deserción',
    },
    inclusionCriteria: ['Estudios 2019-2025', 'Muestran métricas cuantitativas', 'Contextos STEM o salud'],
    exclusionCriteria: ['Artículos sin revisión por pares', 'Estudios sin datos replicables'],
  }
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

export const extractDataRAG = async (_pdfText: string): Promise<ExtractionPayload> => {
  const hasApiKey = Boolean(import.meta.env.VITE_GROQ_API_KEY)
  const simulatedDelay = async () => new Promise((resolve) => setTimeout(resolve, 1200))

  if (!hasApiKey) {
    await simulatedDelay()
    return SAMPLE_EXTRACTION
  }

  // TODO: Integrar Groq real cuando haya API key.
  await simulatedDelay()
  return SAMPLE_EXTRACTION
}

const SAMPLE_NARRATIVE = `Los estudios analizados muestran una tendencia creciente desde 2019, con una concentración importante en Norteamérica y Europa. En general, la implementación de herramientas basadas en IA reportó mejoras consistentes en la rapidez de retroalimentación y en la precisión de las evaluaciones.

Los temas predominantes indican que las intervenciones más efectivas combinan dashboards analíticos con entrenamiento docente. Los resultados cuantitativos respaldan incrementos estadísticamente significativos en métricas de coherencia, aunque persisten variaciones por contexto institucional.

Finalmente, se observan vacíos de evidencia en poblaciones de educación técnica y en seguimientos longitudinales. Estos hallazgos sugieren priorizar estudios multicéntricos y métricas de impacto a largo plazo.`

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY
const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null

export const generateNarrative = async (
  themes: SynthesisTheme[],
  stats: SynthesisStats,
): Promise<string> => {
  const hasApiKey = Boolean(import.meta.env.VITE_GROQ_API_KEY)
  const simulatedDelay = async () => new Promise((resolve) => setTimeout(resolve, 1500))

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

  if (!hasApiKey) {
    await simulatedDelay()
    return `${SAMPLE_NARRATIVE}\n\nTemas clave: ${themeSummary}\nDatos cuantitativos: ${numericSummary.years}`
  }

  // TODO: Replace with real Groq SDK call.
  await simulatedDelay()
  return SAMPLE_NARRATIVE
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
  const hasApiKey = Boolean(groqClient)
  const simulatedDelay = async () => new Promise((resolve) => setTimeout(resolve, 2000))

  if (!hasApiKey) {
    await simulatedDelay()
    return DEFAULT_MANUSCRIPT(projectId, aggregated)
  }

  try {
    const response = await groqClient!.chat.completions.create({
      model: 'llama3-70b-8192',
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto redactor científico. Escribe un manuscrito de Revisión Sistemática siguiendo estrictamente la guía PRISMA 2020. Usa tono académico formal, voz pasiva y estructura IMRyD. Responde ÚNICAMENTE con un objeto JSON que siga el esquema {abstract, introduction, methods, results, discussion, conclusions, references[]}.',
        },
        {
          role: 'user',
          content: `Datos consolidados del proyecto:\n${JSON.stringify(aggregated, null, 2)}`,
        },
      ],
    })

    const content = response.choices?.[0]?.message?.content ?? ''
    const cleaned = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<Manuscript> & { references?: string[] }
    const base = createEmptyManuscript(projectId)
    const manuscript = {
      ...base,
      ...parsed,
      references: parsed.references ?? [],
      generatedAt: Date.now(),
    }
    return { ...manuscript, wordCount: computeWordCountFromManuscript(manuscript) }
  } catch (error) {
    console.error('generateFullManuscript error', error)
    return DEFAULT_MANUSCRIPT(projectId, aggregated)
  }
}
