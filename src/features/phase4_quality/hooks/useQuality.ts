import { useEffect, useMemo, useState } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type {
  CaspCriterion,
  CaspAnswer,
  ChecklistType,
  QualityAssessment,
  QualityLevel,
  StudyType,
} from '../types.ts'
import {
  listenToIncludedStudies,
  listenToQualityAssessments,
  saveQualityAssessment,
} from '../../projects/project.service.ts'

const questionBank: Record<ChecklistType, string[]> = {
  CASP: [
    '¿La pregunta de investigación está claramente definida?',
    '¿El diseño metodológico es apropiado para la pregunta?',
    '¿La selección de participantes minimiza sesgos?',
    '¿Las variables fueron medidas con precisión?',
    '¿Se controlaron factores de confusión clave?',
    '¿Los resultados son consistentes y aplicables?',
    '¿Se evaluaron adecuadamente los riesgos/beneficios?',
    '¿Las conclusiones están justificadas por los datos?',
  ],
  AMSTAR: [
    '¿La pregunta de investigación está claramente definida?',
    '¿El protocolo fue establecido antes del estudio?',
    '¿La estrategia de búsqueda fue adecuada y reproducible?',
    '¿La selección y extracción de estudios se hizo por duplicado?',
    '¿Se evaluó el riesgo de sesgo de los estudios incluidos?',
    '¿Se consideró el riesgo de sesgo al interpretar resultados?',
    '¿Se evaluó la heterogeneidad y se explicó adecuadamente?',
    '¿Se evaluó sesgo de publicación cuando fue pertinente?',
    '¿Se declararon conflictos de interés y fuentes de financiamiento?',
  ],
  STROBE: [
    '¿El diseño del estudio está claramente descrito?',
    '¿La población y el contexto están claramente definidos?',
    '¿Las variables de exposición y resultado están definidas?',
    '¿Se describen métodos para minimizar sesgos?',
    '¿El tamaño muestral está justificado?',
    '¿Los métodos estadísticos son apropiados?',
    '¿Se reportan los resultados principales con precisión?',
    '¿Se discuten limitaciones del estudio?',
    '¿Las conclusiones están sustentadas por los datos?',
  ],
}

const answerScore: Record<CaspAnswer, number> = {
  Yes: 1,
  Partial: 0.5,
  No: 0,
}

const createDefaultCriteria = (checklistType: ChecklistType): CaspCriterion[] =>
  (questionBank[checklistType] ?? questionBank.CASP).map((question, index) => ({
    id: `${checklistType.toLowerCase()}-${index + 1}`,
    question,
    answer: 'No',
    notes: '',
    evidence: '',
    justification: '',
  }))

export const useQuality = (projectId: string) => {
  const [studies, setStudies] = useState<Candidate[]>([])
  const [assessments, setAssessments] = useState<QualityAssessment[]>([])
  const [studiesLoaded, setStudiesLoaded] = useState(false)

  useEffect(() => {
    const unsubscribeStudies = listenToIncludedStudies(projectId, (items) => {
      setStudies(items)
      setStudiesLoaded(true)
    })

    const unsubscribeAssessments = listenToQualityAssessments(projectId, (items) => {
      setAssessments(
        items.map((assessment) => ({
          ...assessment,
          checklistType: assessment.checklistType ?? 'CASP',
        })),
      )
    })

    return () => {
      unsubscribeStudies()
      unsubscribeAssessments()
    }
  }, [projectId])

  const assessmentMap = useMemo(() => {
    return assessments.reduce<Record<string, QualityAssessment>>((acc, assessment) => {
      acc[assessment.studyId] = assessment
      return acc
    }, {})
  }, [assessments])

  const stats = useMemo(() => {
    return assessments.reduce(
      (acc, assessment) => {
        acc[assessment.qualityLevel.toLowerCase() as keyof typeof acc] += 1
        return acc
      },
      { high: 0, medium: 0, low: 0 },
    )
  }, [assessments])

  const calculateScore = (criteria: CaspCriterion[]) => {
    const total = criteria.reduce((sum, criterion) => sum + (answerScore[criterion.answer] ?? 0), 0)
    return Math.round(total * 10) / 10
  }

  const determineLevel = (score: number, maxScore: number): QualityLevel => {
    const safeMax = maxScore > 0 ? maxScore : 1
    const ratio = score / safeMax
    if (ratio >= 0.8) return 'High'
    if (ratio >= 0.55) return 'Medium'
    return 'Low'
  }

  const saveAssessment = async (input: {
    studyId: string
    studyType: StudyType
    checklistType: ChecklistType
    criteria: CaspCriterion[]
    assessmentId?: string
  }) => {
    const totalScore = calculateScore(input.criteria)
    const qualityLevel = determineLevel(totalScore, input.criteria.length)
    const assessment: QualityAssessment = {
      id: input.assessmentId ?? crypto.randomUUID(),
      studyId: input.studyId,
      studyType: input.studyType,
      checklistType: input.checklistType,
      criteria: input.criteria,
      totalScore,
      qualityLevel,
      assessedAt: Date.now(),
    }

    await saveQualityAssessment(projectId, assessment)
  }

  const getAssessmentForStudy = (studyId: string) => assessmentMap[studyId]

  return {
    studies,
    loading: !studiesLoaded,
    assessments,
    stats,
    calculateScore,
    determineLevel,
    saveAssessment,
    getAssessmentForStudy,
    defaultCriteria: createDefaultCriteria,
  }
}

export type QualityStats = {
  high: number
  medium: number
  low: number
}

export const CASP_QUESTIONS = questionBank.CASP
