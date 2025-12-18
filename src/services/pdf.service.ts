import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (typeof window !== 'undefined' && GlobalWorkerOptions) {
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc
}

type PdfSource = File | string

const readFileAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo PDF'))
    reader.readAsArrayBuffer(file)
  })

const fetchPdfAsArrayBuffer = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/pdf,*/*',
    },
  })
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    let details = ''
    try {
      details = (await response.text()).slice(0, 300)
    } catch {
    }
    const suffix = `${contentType ? ` Content-Type: ${contentType}.` : ''}${details ? ` Detalle: ${details}` : ''}`
    throw new Error(`No se pudo descargar el PDF (HTTP ${response.status}).${suffix}`)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]
  let signatureFound = false
  const scanLimit = Math.min(bytes.length, 1024)
  for (let i = 0; i <= scanLimit - signature.length; i += 1) {
    let match = true
    for (let j = 0; j < signature.length; j += 1) {
      if (bytes[i + j] !== signature[j]) {
        match = false
        break
      }
    }
    if (match) {
      signatureFound = true
      break
    }
  }

  if (!signatureFound) {
    const contentType = response.headers.get('content-type') ?? ''
    let snippet = ''
    try {
      snippet = new TextDecoder().decode(buffer.slice(0, 300)).replace(/\s+/g, ' ').trim()
    } catch {
    }
    const suffix = `${contentType ? ` Content-Type: ${contentType}.` : ''}${snippet ? ` Inicio: ${snippet}` : ''}`
    throw new Error(`El enlace no devolvió un PDF válido.${suffix}`)
  }

  return buffer
}

export const extractTextFromPdf = async (source: PdfSource): Promise<string> => {
  let arrayBuffer: ArrayBuffer
  if (typeof source === 'string') {
    arrayBuffer = await fetchPdfAsArrayBuffer(source)
  } else {
    arrayBuffer = await readFileAsArrayBuffer(source)
  }

  let pdf: any
  try {
    const loadingTask = getDocument({ data: arrayBuffer })
    pdf = await loadingTask.promise
  } catch (error) {
    const name = typeof error === 'object' && error ? (error as { name?: string }).name : undefined
    const message = typeof error === 'object' && error ? (error as { message?: string }).message : undefined
    if (name === 'InvalidPDFException' || message?.toLowerCase().includes('invalid pdf')) {
      throw new Error('El PDF no se pudo leer. Asegúrate de que el enlace sea un PDF directo y accesible (sin página intermedia).')
    }
    throw error instanceof Error ? error : new Error('No se pudo leer el PDF')
  }
  let text = ''

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = (content.items as TextItem[])
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    text += `${pageText}\n`
  }

  return text.trim()
}

export const truncateText = (input: string, limit = 20000) => {
  if (input.length <= limit) return input
  return `${input.slice(0, limit)}…`
}

const chunkText = (input: string, chunkSize = 1400, overlap = 200) => {
  const text = input.replace(/\s+/g, ' ').trim()
  if (!text) return [] as string[]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize)
    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= text.length) break
    start = Math.max(0, end - overlap)
  }
  return chunks
}

export const buildRagContext = (input: string, limit = 20000) => {
  const chunks = chunkText(input)
  if (chunks.length <= 1) return truncateText(input, limit)

  const keywords = [
    'abstract',
    'resumen',
    'method',
    'methods',
    'metod',
    'participants',
    'sample',
    'muestra',
    'intervention',
    'intervenci',
    'results',
    'resultados',
    'discussion',
    'discusi',
    'conclusion',
    'conclusi',
    'limitations',
    'limitaciones',
    'p <',
    'p<',
  ]

  const scored = chunks
    .map((chunk, index) => {
      const lower = chunk.toLowerCase()
      let score = 0
      for (const keyword of keywords) {
        if (lower.includes(keyword)) score += 3
      }
      if (/\b\d+\b/.test(lower)) score += 1
      return { chunk, index, score }
    })
    .sort((a, b) => b.score - a.score)

  const selectedIndexes = new Set<number>()
  selectedIndexes.add(0)
  selectedIndexes.add(chunks.length - 1)
  for (const item of scored.slice(0, 10)) selectedIndexes.add(item.index)

  const selected = Array.from(selectedIndexes)
    .sort((a, b) => a - b)
    .map((index) => chunks[index])
    .join('\n\n')

  return truncateText(selected, limit)
}

