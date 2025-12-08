import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { firestore } from './firebase/firebase.ts'
import type { Manuscript } from '../features/phase7_report/types.ts'
import { createEmptyManuscript } from '../features/phase7_report/types.ts'

const projectsCollection = collection(firestore, 'projects')

const getProjectDoc = (projectId: string) => doc(projectsCollection, projectId)
const getManuscriptDoc = (projectId: string) => doc(collection(getProjectDoc(projectId), 'manuscripts'), 'final')

export const listenToManuscript = (projectId: string, callback: (manuscript: Manuscript | null) => void): Unsubscribe => {
  return onSnapshot(getManuscriptDoc(projectId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    callback(snapshot.data() as Manuscript)
  })
}

export const saveManuscript = async (projectId: string, manuscript: Manuscript) => {
  await setDoc(getManuscriptDoc(projectId), manuscript, { merge: true })
}

export const upsertManuscriptSection = async (
  projectId: string,
  manuscript: Manuscript | null,
  field: keyof Manuscript,
  value: Manuscript[keyof Manuscript],
) => {
  const base = manuscript ?? createEmptyManuscript(projectId)
  await saveManuscript(projectId, { ...base, [field]: value })
}
