import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '../../services/firebase/firebase.ts'
import type { Project } from './types.ts'
import {
  createCandidateFromExternal,
  createPrismaData,
  createProjectDefaults,
  type Candidate,
  type PrismaData,
} from './types.ts'
import type { QualityAssessment } from '../phase4_quality/types.ts'
import type { Phase1Data } from '../phase1_planning/types.ts'
import type { ExternalPaper } from '../phase2_search/types.ts'

const projectsCollection = collection(firestore, 'projects')

const mapProjectDoc = (snapshot: QueryDocumentSnapshot<DocumentData>) => snapshot.data() as Project

export const createProject = async (userId: string, data: Partial<Project>) => {
  const projectDoc = doc(projectsCollection)
  const timestamp = Date.now()
  const project = createProjectDefaults({
    ...data,
    id: projectDoc.id,
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const payload = project.templateUsed === undefined ? { ...project, templateUsed: undefined } : project
  if (payload.templateUsed === undefined) {
    delete payload.templateUsed
  }

  await setDoc(projectDoc, payload)
  return project
}

export const getUserProjects = async (userId: string) => {
  const q = query(projectsCollection, where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapProjectDoc)
}

export const listenToProjects = (userId: string, callback: (projects: Project[]) => void): Unsubscribe => {
  const q = query(projectsCollection, where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(mapProjectDoc)
    callback(items)
  })
}

const getProjectDocRef = (projectId: string) => doc(projectsCollection, projectId)
const getCandidatesCollection = (projectId: string) => collection(getProjectDocRef(projectId), 'candidates')
const getIncludedCollection = (projectId: string) => collection(getProjectDocRef(projectId), 'included_studies')
const getQualityAssessmentsCollection = (projectId: string) =>
  collection(getProjectDocRef(projectId), 'quality_assessments')
const getPrismaDocRef = (projectId: string) => doc(collection(getProjectDocRef(projectId), 'prisma'), 'stats')
const getPrismaCollection = (projectId: string) => collection(getProjectDocRef(projectId), 'prisma')

export const listenToProject = (projectId: string, callback: (project: Project | null) => void): Unsubscribe => {
  const projectRef = getProjectDocRef(projectId)
  return onSnapshot(projectRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    callback(snapshot.data() as Project)
  })
}

export const updateProjectPhase1 = async (projectId: string, phase1: Phase1Data) => {
  const projectRef = getProjectDocRef(projectId)
  await updateDoc(projectRef, {
    phase1,
    updatedAt: Date.now(),
  })
}

export const saveProjectCandidates = async (projectId: string, papers: ExternalPaper[]) => {
  const candidatesCollection = getCandidatesCollection(projectId)
  await Promise.all(
    papers.map((paper) => {
      const candidate = createCandidateFromExternal(projectId, paper)
      return setDoc(doc(candidatesCollection, candidate.id), candidate, { merge: true })
    }),
  )
  await updateDoc(getProjectDocRef(projectId), { updatedAt: Date.now() })
}

export const listenToCandidates = (projectId: string, callback: (candidates: Candidate[]) => void): Unsubscribe => {
  return onSnapshot(getCandidatesCollection(projectId), (snapshot) => {
    const items = snapshot.docs.map((candidateDoc) => {
      const data = candidateDoc.data() as Candidate
      return { ...data, id: data.id ?? candidateDoc.id }
    })
    callback(items)
  })
}

export const updateCandidateRecord = async (
  projectId: string,
  candidateId: string,
  updates: Partial<Candidate>,
) => {
  await setDoc(doc(getCandidatesCollection(projectId), candidateId), updates, { merge: true })
}

export const confirmCandidateDecision = async (projectId: string, candidate: Candidate, decision: Candidate['decision']) => {
  await updateCandidateRecord(projectId, candidate.id, {
    decision,
    userConfirmed: true,
    screeningStatus: 'screened',
  })

  if (decision === 'include') {
    await setDoc(doc(getIncludedCollection(projectId), candidate.id), {
      ...candidate,
      decision: 'include',
      confirmedAt: Date.now(),
      qualityStatus: 'pending',
    })
  }
}

export const listenToIncludedStudies = (projectId: string, callback: (studies: Candidate[]) => void): Unsubscribe => {
  return onSnapshot(getIncludedCollection(projectId), (snapshot) => {
    const items = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as Candidate
      return { ...data, id: data.id ?? docSnapshot.id }
    })
    callback(items)
  })
}

export const listenToQualityAssessments = (
  projectId: string,
  callback: (assessments: QualityAssessment[]) => void,
): Unsubscribe => {
  return onSnapshot(getQualityAssessmentsCollection(projectId), (snapshot) => {
    const items = snapshot.docs.map((docSnapshot) => docSnapshot.data() as QualityAssessment)
    callback(items)
  })
}

export const saveQualityAssessment = async (projectId: string, assessment: QualityAssessment) => {
  const assessmentRef = doc(getQualityAssessmentsCollection(projectId), assessment.id)
  const includedRef = doc(getIncludedCollection(projectId), assessment.studyId)

  await Promise.all([
    setDoc(assessmentRef, assessment, { merge: true }),
    setDoc(
      includedRef,
      {
        qualityStatus: 'completed',
        qualityLevel: assessment.qualityLevel,
        qualityScore: assessment.totalScore,
      },
      { merge: true },
    ),
    updateDoc(getProjectDocRef(projectId), { updatedAt: Date.now() }),
  ])
}

export const listenToPrismaData = (projectId: string, callback: (data: PrismaData) => void): Unsubscribe => {
  return onSnapshot(getPrismaDocRef(projectId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(createPrismaData())
      return
    }
    callback({ ...createPrismaData(), ...(snapshot.data() as PrismaData) })
  })
}

const deleteCollectionDocs = async (collectionRef: ReturnType<typeof collection>) => {
  const snapshot = await getDocs(collectionRef)
  if (!snapshot.empty) {
    await Promise.all(snapshot.docs.map((docSnapshot) => deleteDoc(docSnapshot.ref)))
  }
}

export const deleteProject = async (projectId: string) => {
  const projectRef = getProjectDocRef(projectId)

  await Promise.all([
    deleteCollectionDocs(getCandidatesCollection(projectId)),
    deleteCollectionDocs(getIncludedCollection(projectId)),
    deleteCollectionDocs(getQualityAssessmentsCollection(projectId)),
    deleteCollectionDocs(getPrismaCollection(projectId)),
  ])

  await deleteDoc(projectRef)
}

export const updatePrismaData = async (projectId: string, data: Partial<PrismaData>) => {
  await setDoc(getPrismaDocRef(projectId), data, { merge: true })
}
