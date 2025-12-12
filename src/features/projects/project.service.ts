import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import type { Phase2Data, Project } from './types.ts'
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

export const MISSING_ABSTRACT_PLACEHOLDER = 'Resumen no disponible para este registro.'

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
const getCandidateDocRef = (projectId: string, candidateId: string) =>
  doc(getCandidatesCollection(projectId), encodeURIComponent(candidateId))
const getIncludedCollection = (projectId: string) => collection(getProjectDocRef(projectId), 'included_studies')
const getIncludedDocRef = (projectId: string, candidateId: string) =>
  doc(getIncludedCollection(projectId), encodeURIComponent(candidateId))
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

export const savePhase2State = async (projectId: string, phase2: Phase2Data) => {
  const projectRef = getProjectDocRef(projectId)
  await updateDoc(projectRef, {
    phase2,
    updatedAt: Date.now(),
  })
}

const sanitizeFirestoreData = <T>(payload: T): T => {
  if (payload === null || typeof payload !== 'object') {
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.map((entry) => sanitizeFirestoreData(entry)) as T
  }
  const cleanEntry: Record<string, unknown> = {}
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }
    cleanEntry[key] = sanitizeFirestoreData(value)
  })
  return cleanEntry as T
}

const normalizeForKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const buildDedupKey = (paper: Pick<ExternalPaper, 'id' | 'doi' | 'title' | 'authors' | 'year'>): string => {
  if (paper.doi) {
    return `doi:${paper.doi.trim().toLowerCase()}`
  }
  const normalizedTitle = normalizeForKey(paper.title ?? paper.id)
  const primaryAuthor = normalizeForKey(paper.authors?.[0] ?? 'unknown')
  const yearFragment = paper.year ? String(paper.year) : 'na'
  return `title:${normalizedTitle}|author:${primaryAuthor}|year:${yearFragment}`
}

const ensurePrismaCounters = async (
  projectId: string,
  {
    identifiedDelta = 0,
    duplicatesDelta = 0,
    withoutAbstractDelta = 0,
  }: { identifiedDelta?: number; duplicatesDelta?: number; withoutAbstractDelta?: number },
) => {
  if (!identifiedDelta && !duplicatesDelta && !withoutAbstractDelta) return
  const prismaRef = getPrismaDocRef(projectId)
  const snapshot = await getDoc(prismaRef)
  const current = snapshot.exists() ? (snapshot.data() as PrismaData) : createPrismaData()
  const nextPayload: Partial<PrismaData> = {}
  if (identifiedDelta) {
    nextPayload.identified = (current.identified ?? 0) + identifiedDelta
  }
  if (withoutAbstractDelta) {
    nextPayload.withoutAbstract = (current.withoutAbstract ?? 0) + withoutAbstractDelta
  }
  if (duplicatesDelta) {
    nextPayload.duplicates = (current.duplicates ?? 0) + duplicatesDelta
  }
  await setDoc(prismaRef, nextPayload, { merge: true })
}

const syncPrismaAfterDecision = async (
  projectId: string,
  prevDecision: Candidate['decision'] | undefined,
  prevConfirmed: boolean,
  nextDecision: Candidate['decision'],
) => {
  const updates: Partial<PrismaData> = {}
  if (!prevConfirmed) {
    const snapshot = await getDoc(getPrismaDocRef(projectId))
    const current = snapshot.exists() ? (snapshot.data() as PrismaData) : createPrismaData()
    updates.screened = (current.screened ?? 0) + 1
    if (nextDecision === 'include') {
      updates.included = (current.included ?? 0) + 1
    }
    await setDoc(getPrismaDocRef(projectId), updates, { merge: true })
    return
  }

  if (prevDecision === nextDecision) {
    return
  }

  const snapshot = await getDoc(getPrismaDocRef(projectId))
  const current = snapshot.exists() ? (snapshot.data() as PrismaData) : createPrismaData()
  if (prevDecision === 'include' && nextDecision !== 'include') {
    updates.included = Math.max((current.included ?? 0) - 1, 0)
  } else if (prevDecision !== 'include' && nextDecision === 'include') {
    updates.included = (current.included ?? 0) + 1
  }
  if (Object.keys(updates).length > 0) {
    await setDoc(getPrismaDocRef(projectId), updates, { merge: true })
  }
}

export const saveProjectCandidates = async (
  projectId: string,
  papers: ExternalPaper[],
): Promise<{ saved: number; duplicates: number; withoutAbstract: number }> => {
  if (papers.length === 0) {
    return { saved: 0, duplicates: 0, withoutAbstract: 0 }
  }

  const candidatesCollection = getCandidatesCollection(projectId)
  const snapshot = await getDocs(candidatesCollection)
  const existingKeys = new Set<string>()
  const backfillPromises: Promise<void>[] = []

  snapshot.docs.forEach((docSnapshot) => {
    const data = docSnapshot.data() as Candidate
    const computedKey = data.dedupKey ?? buildDedupKey(data)
    existingKeys.add(computedKey)
    if (!data.dedupKey) {
      backfillPromises.push(setDoc(docSnapshot.ref, { dedupKey: computedKey }, { merge: true }))
    }
  })

  const newCandidates: Candidate[] = []
  const batchKeys = new Set<string>()
  let duplicates = 0
  let withoutAbstract = 0

  papers.forEach((paper) => {
    const abstractText = paper.abstract?.trim() ?? ''
    if (abstractText.length === 0 || abstractText === MISSING_ABSTRACT_PLACEHOLDER) {
      withoutAbstract += 1
      return
    }
    const dedupKey = buildDedupKey(paper)
    if (existingKeys.has(dedupKey) || batchKeys.has(dedupKey)) {
      duplicates += 1
      return
    }
    batchKeys.add(dedupKey)
    const candidate = sanitizeFirestoreData(createCandidateFromExternal(projectId, paper, dedupKey))
    newCandidates.push(candidate)
  })

  await Promise.all(
    newCandidates.map((candidate) => setDoc(getCandidateDocRef(projectId, candidate.id), candidate, { merge: true })),
  )

  if (backfillPromises.length) {
    await Promise.all(backfillPromises)
  }

  await updateDoc(getProjectDocRef(projectId), { updatedAt: Date.now() })
  await ensurePrismaCounters(projectId, {
    identifiedDelta: papers.length,
    duplicatesDelta: duplicates,
    withoutAbstractDelta: withoutAbstract,
  })

  return { saved: newCandidates.length, duplicates, withoutAbstract }
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
  await setDoc(getCandidateDocRef(projectId, candidateId), updates, { merge: true })
}

export const confirmCandidateDecision = async (
  projectId: string,
  candidate: Candidate,
  decision: Candidate['decision'],
) => {
  const wasConfirmed = Boolean(candidate.userConfirmed)
  const previousDecision = candidate.decision

  await updateCandidateRecord(projectId, candidate.id, {
    decision,
    userConfirmed: true,
    screeningStatus: 'screened',
  })

  await syncPrismaAfterDecision(projectId, previousDecision, wasConfirmed, decision)

  if (decision === 'include') {
    await setDoc(getIncludedDocRef(projectId, candidate.id), {
      ...candidate,
      decision: 'include',
      confirmedAt: Date.now(),
      qualityStatus: 'pending',
    })
  } else if (wasConfirmed && previousDecision === 'include') {
    await deleteDoc(getIncludedDocRef(projectId, candidate.id))
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
