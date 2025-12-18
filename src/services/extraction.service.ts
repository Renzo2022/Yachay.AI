import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { firestore } from './firebase/firebase.ts'
import type { ExtractionData } from '../features/phase5_extraction/types.ts'

const projectsCollection = collection(firestore, 'projects')

const getProjectDoc = (projectId: string) => doc(projectsCollection, projectId)
const getExtractionCollection = (projectId: string) => collection(getProjectDoc(projectId), 'extraction_matrix')
const getIncludedCollection = (projectId: string) => collection(getProjectDoc(projectId), 'included_studies')

const sanitizeFirestoreValue = (value: unknown): unknown => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value)) {
    const next = value
      .map((item) => sanitizeFirestoreValue(item))
      .filter((item) => item !== undefined)
    return next
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, sanitizeFirestoreValue(val)] as const)
      .filter(([, val]) => val !== undefined)
    return Object.fromEntries(entries)
  }
  return value
}

export const listenToExtractionMatrix = (
  projectId: string,
  callback: (entries: ExtractionData[]) => void,
): Unsubscribe => {
  return onSnapshot(getExtractionCollection(projectId), (snapshot) => {
    const entries = snapshot.docs.map((docSnapshot) => docSnapshot.data() as ExtractionData)
    callback(entries)
  })
}

export const saveExtractionEntry = async (projectId: string, data: ExtractionData) => {
  const extractionRef = doc(getExtractionCollection(projectId), data.id)
  const includedRef = doc(getIncludedCollection(projectId), encodeURIComponent(data.studyId))

  const sanitized = sanitizeFirestoreValue(data) as ExtractionData

  await Promise.all([
    setDoc(extractionRef, sanitized, { merge: true }),
    setDoc(
      includedRef,
      {
        extractionStatus: sanitized.status === 'verified' ? 'verified' : 'extracted',
        extractionId: sanitized.id,
      },
      { merge: true },
    ),
  ])
}
