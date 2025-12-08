import { initializeApp, getApps } from 'firebase/app'
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const requiredEnvMap = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingEnv = Object.entries(requiredEnvMap)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingEnv.length) {
  console.warn(
    `Faltan variables de entorno Firebase: ${missingEnv.join(
      ', ',
    )}. Asegúrate de definirlas en tu archivo .env.`,
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
const auth = getAuth(app)

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('No se pudo fijar persistence local para Firebase Auth', error)
})

export const firebaseAuth = auth
export const firestore = getFirestore(app)
