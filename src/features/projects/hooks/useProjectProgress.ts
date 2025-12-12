import { useEffect, useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { firestore } from '../../../services/firebase/firebase.ts'
import type { Project, Candidate, Phase2Data, PhaseKey, PrismaData } from '../types.ts'
import type { Phase1Data } from '../../phase1_planning/types.ts'
import type { QualityAssessment } from '../../phase4_quality/types.ts'
import type { ExtractionData } from '../../phase5_extraction/types.ts'
import type { SynthesisData } from '../../phase6_synthesis/types.ts'
import type { Manuscript } from '../../phase7_report/types.ts'
import { createDefaultSynthesis } from '../../phase6_synthesis/types.ts'
import {
  listenToProject,
  listenToCandidates,
  listenToIncludedStudies,
  listenToQualityAssessments,
  listenToPrismaData,
} from '../project.service.ts'
import { listenToExtractionMatrix } from '../../../services/extraction.service.ts'
import { listenToSynthesisData } from '../../../services/synthesis.service.ts'
import { listenToManuscript } from '../../../services/manuscript.service.ts'
import { useToast } from '../../../core/toast/ToastProvider.tsx'

const PHASE_TASKS = {
  phase1: 5,
  phase2: 4,
  phase3: 4,
  phase4: 3,
  phase5: 3,
  phase6: 3,
  phase7: 4,
} as const

export type PhaseProgressMap = Record<PhaseKey, { completed: number; total: number }>

const computePhase1Completion = (data?: Phase1Data | null): number => {
  if (!data) return 0
  const tasks = [
    Boolean(data.mainQuestion.trim()),
    data.subquestions.length > 0,
    ['population', 'intervention', 'comparison', 'outcome'].every((key) =>
      Boolean(data.pico[key as keyof Phase1Data['pico']]?.trim()),
    ),
    Boolean(data.objectives.trim()),
    data.inclusionCriteria.length > 0 && data.exclusionCriteria.length > 0,
  ]
  return tasks.filter(Boolean).length
}

const computePhase2Completion = (phase2?: Phase2Data | null, candidates: Candidate[] = []): number => {
  const steps = [
    Boolean(phase2?.lastStrategy),
    (phase2?.lockedSubquestions?.length ?? 0) > 0,
    candidates.length > 0,
    Boolean(phase2?.documentationGeneratedAt),
  ]
  return steps.filter(Boolean).length
}

const computePhase3Completion = (candidates: Candidate[], prisma: PrismaData | null): number => {
  const dedupDone = Boolean(prisma) && prisma!.identified > 0 && prisma!.identified >= (prisma!.duplicates ?? 0)
  const screeningDone = candidates.length > 0 && candidates.every((candidate) => candidate.userConfirmed)
  const documentationDone = candidates
    .filter((candidate) => candidate.decision === 'exclude')
    .every((candidate) => Boolean(candidate.reason))
  const prismaReady = Boolean(prisma) && prisma!.screened > 0 && prisma!.included >= 0

  const steps = [dedupDone, screeningDone, documentationDone, prismaReady]
  return steps.filter(Boolean).length
}

const computePhase4Completion = (quality: QualityAssessment[], included: Candidate[]): number => {
  if (included.length === 0) return 0
  const completed = new Set(quality.map((assessment) => assessment.studyId)).size
  const ratio = completed / included.length
  return Math.min(PHASE_TASKS.phase4, Math.floor(ratio * PHASE_TASKS.phase4))
}

const computePhase5Completion = (extractions: ExtractionData[], included: Candidate[]): number => {
  const target = included.length || extractions.length
  if (target === 0) return 0
  const verified = extractions.filter((entry) => entry.status === 'verified').length
  const ratio = verified / target
  return Math.min(PHASE_TASKS.phase5, Math.round(ratio * PHASE_TASKS.phase5))
}

const computePhase6Completion = (synthesis: SynthesisData): number => {
  const steps = [
    synthesis.themes.length > 0,
    Boolean(synthesis.narrative.trim()),
    synthesis.gaps.some((gap) => gap.trim()),
  ]
  return steps.filter(Boolean).length
}

const computePhase7Completion = (manuscript: Manuscript | null): number => {
  if (!manuscript) return 0
  const sections = [
    manuscript.abstract,
    manuscript.methods,
    manuscript.results,
    manuscript.discussion,
    manuscript.conclusions,
  ]
  const filled = sections.filter((section) => Boolean(section?.trim())).length
  const hasReferences = manuscript.references.length > 0
  const steps = [filled >= 1, filled >= 3, filled >= 5, hasReferences]
  return steps.filter(Boolean).length
}

const phaseOrder: PhaseKey[] = ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7']

export const useProjectProgress = (projectId?: string) => {
  const { showToast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(Boolean(projectId))
  const [phase1Data, setPhase1Data] = useState<Phase1Data | null>(null)
  const [screeningCandidates, setScreeningCandidates] = useState<Candidate[]>([])
  const [includedStudies, setIncludedStudies] = useState<Candidate[]>([])
  const [qualityAssessments, setQualityAssessments] = useState<QualityAssessment[]>([])
  const [extractions, setExtractions] = useState<ExtractionData[]>([])
  const [synthesis, setSynthesis] = useState<SynthesisData>(createDefaultSynthesis())
  const [manuscript, setManuscript] = useState<Manuscript | null>(null)
  const [prisma, setPrisma] = useState<PrismaData | null>(null)

  useEffect(() => {
    if (!projectId) {
      setProject(null)
      setPhase1Data(null)
      setLoading(false)
      return undefined
    }

    const unsubscribers = [
      listenToProject(projectId, (projectData) => {
        setProject(projectData)
        setPhase1Data(projectData?.phase1 ?? null)
        setLoading(false)
      }),
      listenToCandidates(projectId, (items) => setScreeningCandidates(items)),
      listenToIncludedStudies(projectId, (items) => setIncludedStudies(items)),
      listenToQualityAssessments(projectId, (items) => setQualityAssessments(items)),
      listenToExtractionMatrix(projectId, (entries) => setExtractions(entries)),
      listenToSynthesisData(projectId, (data) => setSynthesis(data)),
      listenToManuscript(projectId, (data) => setManuscript(data)),
      listenToPrismaData(projectId, (data) => setPrisma(data)),
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.())
    }
  }, [projectId])

  const phaseProgress = useMemo<PhaseProgressMap>(() => {
    const progress: PhaseProgressMap = {
      phase1: { completed: computePhase1Completion(phase1Data), total: PHASE_TASKS.phase1 },
      phase2: { completed: computePhase2Completion(project?.phase2, screeningCandidates), total: PHASE_TASKS.phase2 },
      phase3: { completed: computePhase3Completion(screeningCandidates, prisma), total: PHASE_TASKS.phase3 },
      phase4: { completed: computePhase4Completion(qualityAssessments, includedStudies), total: PHASE_TASKS.phase4 },
      phase5: { completed: computePhase5Completion(extractions, includedStudies), total: PHASE_TASKS.phase5 },
      phase6: { completed: computePhase6Completion(synthesis), total: PHASE_TASKS.phase6 },
      phase7: { completed: computePhase7Completion(manuscript), total: PHASE_TASKS.phase7 },
    }
    return progress
  }, [phase1Data, screeningCandidates, qualityAssessments, includedStudies, extractions, synthesis, manuscript, prisma])

  const currentPhase = useMemo(() => {
    for (const key of phaseOrder) {
      const { completed, total } = phaseProgress[key]
      if (completed < total) {
        return key
      }
    }
    return 'phase7'
  }, [phaseProgress])

  const totalTasks = useMemo(() => Object.values(PHASE_TASKS).reduce((sum, value) => sum + value, 0), [])
  const completedTasks = useMemo(
    () => Object.values(phaseProgress).reduce((sum, phase) => sum + phase.completed, 0),
    [phaseProgress],
  )
  const progressPercent = useMemo(() => Math.round((completedTasks / totalTasks) * 100) || 0, [completedTasks, totalTasks])

  useEffect(() => {
    if (!projectId) return
    if (!project) return
    if (project.completedTasks === completedTasks && project.totalTasks === totalTasks && project.currentPhase === currentPhase)
      return

    const projectRef = doc(firestore, 'projects', projectId)
    updateDoc(projectRef, {
      completedTasks,
      totalTasks,
      currentPhase,
      updatedAt: Date.now(),
    }).catch((error) => {
      console.error('Failed to update project progress', error)
      showToast({ type: 'error', message: 'No se pudo actualizar el progreso del proyecto' })
    })
  }, [projectId, project, completedTasks, totalTasks, currentPhase, showToast])

  return {
    project,
    loading,
    totalTasks,
    completedTasks,
    progressPercent,
    phaseProgress,
    currentPhase,
  }
}
