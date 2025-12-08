import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { firestore } from './firebase/firebase.ts'
import type { Project } from '../features/projects/types.ts'
import type { Phase1Data } from '../features/phase1_planning/types.ts'
import type { PrismaData } from '../features/projects/types.ts'
import { createPrismaData } from '../features/projects/types.ts'
import type { QualityAssessment } from '../features/phase4_quality/types.ts'
import type { ExtractionData } from '../features/phase5_extraction/types.ts'
import type { SynthesisData } from '../features/phase6_synthesis/types.ts'
import { createDefaultSynthesis } from '../features/phase6_synthesis/types.ts'
import type { Candidate } from '../features/projects/types.ts'

const projectsCollection = collection(firestore, 'projects')

const getProjectDoc = (projectId: string) => doc(projectsCollection, projectId)
const getSubcollection = (projectId: string, name: string) => collection(getProjectDoc(projectId), name)

export interface AggregatedProjectData {
  project?: Project | null
  phase1?: Phase1Data | null
  searchStrategies?: unknown
  prisma: PrismaData
  qualityAssessments: QualityAssessment[]
  includedStudies: Candidate[]
  extractionMatrix: ExtractionData[]
  synthesis: SynthesisData
}

export const aggregateProjectData = async (projectId: string): Promise<AggregatedProjectData> => {
  const projectRef = getProjectDoc(projectId)
  const projectSnap = await getDoc(projectRef)
  const project = projectSnap.exists() ? (projectSnap.data() as Project) : null
  const phase1 = project?.phase1 ?? null
  const searchStrategies = (project as Project & { searchStrategies?: unknown })?.searchStrategies ?? []

  const prismaSnap = await getDoc(doc(getSubcollection(projectId, 'prisma'), 'stats'))
  const prisma = prismaSnap.exists() ? (prismaSnap.data() as PrismaData) : createPrismaData()

  const qualitySnapshots = await getDocs(getSubcollection(projectId, 'quality_assessments'))
  const qualityAssessments = qualitySnapshots.docs.map((docSnapshot) => docSnapshot.data() as QualityAssessment)

  const includedSnapshots = await getDocs(getSubcollection(projectId, 'included_studies'))
  const includedStudies = includedSnapshots.docs.map((docSnapshot) => docSnapshot.data() as Candidate)

  const extractionSnapshots = await getDocs(getSubcollection(projectId, 'extraction_matrix'))
  const extractionMatrix = extractionSnapshots.docs.map((docSnapshot) => docSnapshot.data() as ExtractionData)

  const synthesisDoc = await getDoc(doc(getSubcollection(projectId, 'synthesis'), 'state'))
  const synthesis = synthesisDoc.exists()
    ? ({ ...createDefaultSynthesis(), ...(synthesisDoc.data() as SynthesisData) } as SynthesisData)
    : createDefaultSynthesis()

  return {
    project,
    phase1,
    searchStrategies,
    prisma,
    qualityAssessments,
    includedStudies,
    extractionMatrix,
    synthesis,
  }
}
