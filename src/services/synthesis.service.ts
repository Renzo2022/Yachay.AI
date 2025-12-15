import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { firestore } from './firebase/firebase.ts'
import type { SynthesisData, SynthesisTheme } from '../features/phase6_synthesis/types.ts'
import { createDefaultSynthesis } from '../features/phase6_synthesis/types.ts'

const projectsCollection = collection(firestore, 'projects')

const getProjectDoc = (projectId: string) => doc(projectsCollection, projectId)
const getSynthesisDoc = (projectId: string) => doc(collection(getProjectDoc(projectId), 'synthesis'), 'state')

const normalizeTheme = (raw: Partial<SynthesisTheme> & Record<string, unknown>): SynthesisTheme => {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : crypto.randomUUID()
  const relatedStudies = Array.isArray(raw.relatedStudies) ? raw.relatedStudies.filter((item) => typeof item === 'string') : []

  const legacyTitle = typeof (raw as any).title === 'string' ? ((raw as any).title as string) : ''
  const legacyDescription = typeof (raw as any).description === 'string' ? ((raw as any).description as string) : ''

  const theme = typeof raw.theme === 'string' ? raw.theme : legacyTitle
  const subtheme = typeof raw.subtheme === 'string' ? raw.subtheme : ''
  const example = typeof raw.example === 'string' ? raw.example : legacyDescription

  const studyCount = typeof raw.studyCount === 'number' && !Number.isNaN(raw.studyCount) ? raw.studyCount : relatedStudies.length

  return {
    id,
    theme: theme ?? '',
    subtheme: subtheme ?? '',
    example: example ?? '',
    studyCount,
    relatedStudies,
  }
}

export const listenToSynthesisData = (projectId: string, callback: (data: SynthesisData) => void): Unsubscribe => {
  return onSnapshot(getSynthesisDoc(projectId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(createDefaultSynthesis())
      return
    }

    const base = { ...createDefaultSynthesis(), ...(snapshot.data() as SynthesisData) }
    const themes = Array.isArray((base as any).themes) ? (base as any).themes : []
    callback({
      ...base,
      themes: themes.map((item: any) => normalizeTheme(item ?? {})),
      divergences: Array.isArray((base as any).divergences) ? (base as any).divergences : [],
      gaps: Array.isArray((base as any).gaps) ? (base as any).gaps : [],
      narrative: typeof (base as any).narrative === 'string' ? (base as any).narrative : '',
    })
  })
}

export const saveSynthesisData = async (projectId: string, data: Partial<SynthesisData>) => {
  await setDoc(getSynthesisDoc(projectId), data, { merge: true })
}

export const upsertTheme = async (projectId: string, theme: SynthesisTheme) => {
  await setDoc(
    getSynthesisDoc(projectId),
    {
      themes: [{ ...theme }],
    },
    { merge: true },
  )
}
