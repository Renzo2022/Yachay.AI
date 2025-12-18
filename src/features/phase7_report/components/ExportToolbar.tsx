import { useState } from 'react'
import { AlignmentType, Document, Packer, Paragraph, TextRun, ImageRun, ExternalHyperlink } from 'docx'
import type { IParagraphOptions } from 'docx'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { Manuscript } from '../types.ts'
import type { ManuscriptLanguage } from '../types.ts'

interface ExportToolbarProps {
  manuscript: Manuscript
  projectName: string
  reportTitle: string
  keywords?: string[]
  keywordsEn?: string[]
  matrixRowCount?: number
  onRegenerate?: (language: ManuscriptLanguage) => Promise<void>
  regenerating?: boolean
}

const downloadFile = (content: BlobPart, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const captureElementPng = async (elementId: string) => {
  const element = document.getElementById(elementId)
  if (!element) return null
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}

const captureElementCanvas = async (elementId: string) => {
  const element = document.getElementById(elementId)
  if (!element) return null
  return html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
}

const sliceCanvas = (canvas: HTMLCanvasElement, sliceHeightPx: number) => {
  const slices: Array<{ dataUrl: string; width: number; height: number }> = []
  const totalHeight = canvas.height
  const width = canvas.width
  for (let y = 0; y < totalHeight; y += sliceHeightPx) {
    const height = Math.min(sliceHeightPx, totalHeight - y)
    const slice = document.createElement('canvas')
    slice.width = width
    slice.height = height
    const ctx = slice.getContext('2d')
    if (!ctx) break
    ctx.drawImage(canvas, 0, y, width, height, 0, 0, width, height)
    slices.push({ dataUrl: slice.toDataURL('image/png'), width, height })
  }
  return slices
}

const dataUrlToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const ExportToolbar = ({
  manuscript,
  projectName,
  reportTitle,
  keywords,
  keywordsEn,
  matrixRowCount,
  onRegenerate,
  regenerating,
}: ExportToolbarProps) => {
  const [downloading, setDownloading] = useState(false)
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState<ManuscriptLanguage>('es')

  const isEnglish = manuscript.language === 'en'

  const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const baseName = `${safeName || 'manuscrito'}`

  const keywordsLine = ((manuscript.keywords?.length ? manuscript.keywords : keywords) ?? []).filter(Boolean).join(', ')
  const keywordsLineEn =
    ((manuscript.keywordsEn?.length ? manuscript.keywordsEn : keywordsEn) ?? []).filter(Boolean).join(', ')

  const keywordsForEnglish = keywordsLineEn || keywordsLine

  const authorName = (manuscript.authorName ?? '').trim()
  const rawOrcid = (manuscript.authorOrcid ?? '').trim()
  const orcidUrl = rawOrcid
    ? rawOrcid.startsWith('http')
      ? rawOrcid
      : `https://orcid.org/${rawOrcid.replace(/^orcid\.org\//i, '')}`
    : ''

  const fig1Label = isEnglish ? 'Figure 1: PRISMA 2020 flow diagram' : 'Figura 1: Diagrama PRISMA 2020'
  const table1Label = isEnglish ? 'Table 1: Comparative matrix (summary)' : 'Tabla 1: Matriz comparativa (resumen)'
  const fig2Label = isEnglish ? 'Figure 2: Distribution by year' : 'Figura 2: Distribución por año'
  const fig3Label = isEnglish ? 'Figure 3: Distribution by country' : 'Figura 3: Distribución por país'
  const sourceText = isEnglish ? "Source: Authors' elaboration" : 'Fuente: Elaboración propia'

  const handleMarkdownExport = () => {
    const mdBlocks: string[] = []
    mdBlocks.push(`# ${reportTitle || projectName}`)
    if (authorName) {
      const orcidPart = orcidUrl ? ` [iD](${orcidUrl})` : ''
      mdBlocks.push(`${authorName}${orcidPart}`)
    }

    if (isEnglish) {
      mdBlocks.push(`## Abstract\n${manuscript.abstract}`)
      mdBlocks.push(`**Keywords:** ${keywordsForEnglish || '—'}`)
      mdBlocks.push(`## Introduction\n${manuscript.introduction}`)
      mdBlocks.push(`## Methods\n${manuscript.methods}`)
      mdBlocks.push(`## Results\n${manuscript.results}`)
      mdBlocks.push(`### **Figure 1.** PRISMA 2020 flow diagram\n***${sourceText}***`)
      mdBlocks.push(`### **Table 1.** Comparative matrix (summary)\n***${sourceText}***`)
      mdBlocks.push(`### **Figure 2.** Distribution by year\n***${sourceText}***`)
      mdBlocks.push(`### **Figure 3.** Distribution by country\n***${sourceText}***`)
      mdBlocks.push(`## Discussion\n${manuscript.discussion}`)
      mdBlocks.push(`## Conclusions\n${manuscript.conclusions}`)
    } else {
      mdBlocks.push(`## Resumen\n${manuscript.abstract}`)
      mdBlocks.push(`**Palabras clave:** ${keywordsLine || '—'}`)
      mdBlocks.push(`## Abstract\n${manuscript.abstractEn || ''}`)
      mdBlocks.push(`**Keywords:** ${keywordsForEnglish || '—'}`)
      mdBlocks.push(`## Introducción\n${manuscript.introduction}`)
      mdBlocks.push(`## Métodos\n${manuscript.methods}`)
      mdBlocks.push(`## Resultados\n${manuscript.results}`)
      mdBlocks.push(`### **Figura 1.** Diagrama PRISMA 2020\n***${sourceText}***`)
      mdBlocks.push(`### **Tabla 1.** Matriz comparativa (resumen)\n***${sourceText}***`)
      mdBlocks.push(`### **Figura 2.** Distribución por año\n***${sourceText}***`)
      mdBlocks.push(`### **Figura 3.** Distribución por país\n***${sourceText}***`)
      mdBlocks.push(`## Discusión\n${manuscript.discussion}`)
      mdBlocks.push(`## Conclusiones\n${manuscript.conclusions}`)
    }

    mdBlocks.push(`## ${isEnglish ? 'References' : 'Referencias'}\n${manuscript.references.map((ref, idx) => `${idx + 1}. ${ref}`).join('\n')}`)

    const md = mdBlocks.join('\n\n')
    downloadFile(md, `${baseName}.md`, 'text/markdown')
  }

  const handleWordExport = async () => {
    setDownloading(true)
    try {
      const fontName = 'Arial'
      const fontSize = 22

      const resultsImages = {
        prisma: await captureElementPng('phase7-fig-prisma'),
        byYear: await captureElementPng('phase7-fig-by-year'),
        byCountry: await captureElementPng('phase7-fig-by-country'),
      }

      const matrixCanvas = matrixRowCount ? await captureElementCanvas('phase7-table-matrix') : null
      const matrixSlices = matrixCanvas
        ? sliceCanvas(matrixCanvas, Math.floor((650 * matrixCanvas.width) / 560))
        : []

      const sections: Array<{ title: string; field: keyof Manuscript; keywordsLabel?: string; keywordsValue?: string }> =
        isEnglish
          ? [
              { title: 'Abstract', field: 'abstract', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
              { title: 'Introduction', field: 'introduction' },
              { title: 'Methods', field: 'methods' },
              { title: 'Results', field: 'results' },
              { title: 'Discussion', field: 'discussion' },
              { title: 'Conclusions', field: 'conclusions' },
            ]
          : [
              { title: 'Resumen', field: 'abstract', keywordsLabel: 'Palabras clave', keywordsValue: keywordsLine },
              { title: 'Abstract', field: 'abstractEn', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
              { title: 'Introducción', field: 'introduction' },
              { title: 'Métodos', field: 'methods' },
              { title: 'Resultados', field: 'results' },
              { title: 'Discusión', field: 'discussion' },
              { title: 'Conclusiones', field: 'conclusions' },
            ]

      const toParagraphs = (content: string, alignment?: IParagraphOptions['alignment']) =>
        content
          .split(/\n{2,}/)
          .map((chunk) =>
            new Paragraph({
              children: [new TextRun({ text: chunk, font: fontName, size: fontSize })],
              spacing: { after: 200 },
              alignment,
            }),
          )

      const toImageParagraphs = (image: { dataUrl: string; width: number; height: number } | null) => {
        if (!image) return []
        const maxWidth = 560
        const ratio = image.height / image.width
        const width = Math.min(maxWidth, image.width)
        const height = Math.round(width * ratio)
        return [
          new Paragraph({
            children: [
              new ImageRun({
                data: dataUrlToUint8Array(image.dataUrl),
                transformation: { width, height },
              }),
            ],
            spacing: { after: 200 },
          }),
        ]
      }

      const captionTitleParagraph = (label: string) =>
        new Paragraph({
          children: [new TextRun({ text: label, bold: true, italics: true, font: fontName, size: fontSize })],
          spacing: { after: 80 },
        })

      const sourceParagraph = () =>
        new Paragraph({
          children: [new TextRun({ text: sourceText, bold: true, italics: true, font: fontName, size: fontSize })],
          spacing: { after: 200 },
        })

      const pageBreakParagraph = () =>
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        })

      const toImageParagraphsPaged = (images: Array<{ dataUrl: string; width: number; height: number }>) => {
        if (!images.length) return []
        const paragraphs: Paragraph[] = []
        images.forEach((img, index) => {
          if (index > 0) paragraphs.push(pageBreakParagraph())
          paragraphs.push(...toImageParagraphs(img))
        })
        return paragraphs
      }

      const buildResultsAssets = () => {
        const children: Paragraph[] = []

        children.push(captionTitleParagraph(fig1Label))
        children.push(...toImageParagraphs(resultsImages.prisma))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(table1Label))
        if (matrixSlices.length) {
          children.push(...toImageParagraphsPaged(matrixSlices))
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: '(Sin datos)', font: fontName, size: fontSize })],
              spacing: { after: 200 },
            }),
          )
        }
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(fig2Label))
        children.push(...toImageParagraphs(resultsImages.byYear))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(fig3Label))
        children.push(...toImageParagraphs(resultsImages.byCountry))
        children.push(sourceParagraph())

        return children
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [new TextRun({ text: reportTitle || projectName, bold: true, font: fontName, size: fontSize })],
                alignment: AlignmentType.CENTER,
              }),
              ...(authorName
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: authorName, font: fontName, size: fontSize }),
                        ...(orcidUrl
                          ? [
                              new TextRun({ text: ' ', font: fontName, size: fontSize }),
                              new ExternalHyperlink({
                                link: orcidUrl,
                                children: [
                                  new TextRun({
                                    text: 'iD',
                                    bold: true,
                                    color: 'A6CE39',
                                    font: fontName,
                                    size: fontSize,
                                  }),
                                ],
                              }),
                            ]
                          : []),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 },
                    }),
                  ]
                : []),
              ...sections.flatMap((section) => {
                const content = String((manuscript as any)[section.field] ?? '')
                const titleParagraph = new Paragraph({
                  children: [new TextRun({ text: section.title, bold: true, font: fontName, size: fontSize })],
                  spacing: { after: 120 },
                })

                if (section.keywordsLabel) {
                  return [
                    titleParagraph,
                    ...toParagraphs(content, AlignmentType.JUSTIFIED),
                    new Paragraph({
                      children: [
                        new TextRun({ text: `${section.keywordsLabel}: `, bold: true, font: fontName, size: fontSize }),
                        new TextRun({ text: section.keywordsValue || '—', font: fontName, size: fontSize }),
                      ],
                      spacing: { after: 200 },
                      alignment: AlignmentType.JUSTIFIED,
                    }),
                  ]
                }

                if (section.field === 'results') {
                  return [
                    titleParagraph,
                    ...toParagraphs(content, AlignmentType.JUSTIFIED),
                    ...buildResultsAssets(),
                  ]
                }

                return [
                  titleParagraph,
                  ...toParagraphs(content, AlignmentType.JUSTIFIED),
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: isEnglish ? 'References' : 'Referencias',
                    bold: true,
                    font: fontName,
                    size: fontSize,
                  }),
                ],
                spacing: { after: 120 },
              }),
              ...manuscript.references.map(
                (reference, index) =>
                  new Paragraph({
                    children: [new TextRun({ text: `${index + 1}. ${reference}`, font: fontName, size: fontSize })],
                    spacing: { after: 100 },
                    alignment: AlignmentType.JUSTIFIED,
                  }),
              ),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      downloadFile(blob, `${baseName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    } finally {
      setDownloading(false)
    }
  }

  const handlePdfExport = async () => {
    const pdf = new jsPDF({
      unit: 'pt',
      format: 'a4',
    })

    let cursorY = 60
    const marginX = 50
    const maxWidth = 500

    const ensureSpace = (height = 20) => {
      if (cursorY + height > 780) {
        pdf.addPage()
        cursorY = 60
      }
    }

    const pageWidth = pdf.internal.pageSize.getWidth()
    const setFont = (style: 'normal' | 'bold' | 'italic' | 'bolditalic') => {
      pdf.setFont('helvetica', style)
      pdf.setFontSize(11)
    }

    const addCenteredHeading = (text: string) => {
      setFont('bold')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        ensureSpace(30)
        pdf.text(line, pageWidth / 2, cursorY, { align: 'center' })
        cursorY += 16
      })
      cursorY += 10
    }

    const addHeading = (text: string) => {
      ensureSpace(18)
      setFont('bold')
      pdf.text(text, marginX, cursorY)
      cursorY += 18
    }

    const addJustifiedParagraph = (text: string) => {
      setFont('normal')
      const paragraphs = String(text ?? '')
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)

      const lineHeight = 14

      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean)
        let lineWords: string[] = []
        let lineWidth = 0

        const flushLine = (justify: boolean) => {
          if (!lineWords.length) return
          ensureSpace(lineHeight)
          if (!justify || lineWords.length === 1) {
            pdf.text(lineWords.join(' '), marginX, cursorY)
            cursorY += lineHeight
            lineWords = []
            lineWidth = 0
            return
          }

          const joined = lineWords.join(' ')
          const joinedWidth = pdf.getTextWidth(joined)
          const gaps = lineWords.length - 1
          const extra = Math.max(0, maxWidth - joinedWidth)
          const extraPerGap = extra / gaps

          let x = marginX
          for (let idx = 0; idx < lineWords.length; idx += 1) {
            const word = lineWords[idx]
            pdf.text(word, x, cursorY)
            x += pdf.getTextWidth(word)
            if (idx < lineWords.length - 1) {
              x += pdf.getTextWidth(' ') + extraPerGap
            }
          }
          cursorY += lineHeight
          lineWords = []
          lineWidth = 0
        }

        for (const word of words) {
          const candidate = lineWords.length ? `${lineWords.join(' ')} ${word}` : word
          const candidateWidth = pdf.getTextWidth(candidate)
          if (candidateWidth <= maxWidth) {
            lineWords.push(word)
            lineWidth = candidateWidth
          } else {
            flushLine(true)
            lineWords.push(word)
            lineWidth = pdf.getTextWidth(word)
          }
        }
        flushLine(false)
        cursorY += 6
      }
    }

    const addCaption = (text: string) => {
      setFont('bolditalic')
      ensureSpace(16)
      pdf.text(text, marginX, cursorY)
      cursorY += 18
    }

    const addSource = () => {
      setFont('bolditalic')
      ensureSpace(16)
      pdf.text(sourceText, marginX, cursorY)
      cursorY += 20
    }

    const addImageFromElement = async (elementId: string) => {
      const image = await captureElementPng(elementId)
      if (!image?.dataUrl) return
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 40
      const usableWidth = pageWidth - margin * 2
      const ratio = image.height / image.width
      const height = usableWidth * ratio
      if (cursorY + height > 780) {
        pdf.addPage()
        cursorY = 60
      }
      pdf.addImage(image.dataUrl, 'PNG', margin, cursorY, usableWidth, height)
      cursorY += height + 12
    }

    const addMatrixFromElementPaged = async (elementId: string) => {
      const canvas = await captureElementCanvas(elementId)
      if (!canvas) return
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 40
      const usableWidth = pageWidth - margin * 2

      const slicePx = Math.floor((700 * canvas.width) / usableWidth)
      const slices = sliceCanvas(canvas, slicePx)

      for (const slice of slices) {
        const ratio = slice.height / slice.width
        const height = usableWidth * ratio
        if (cursorY + height > 780) {
          pdf.addPage()
          cursorY = 60
        }
        pdf.addImage(slice.dataUrl, 'PNG', margin, cursorY, usableWidth, height)
        cursorY += height + 12
      }
    }

    addCenteredHeading(reportTitle || projectName)

    if (authorName) {
      setFont('normal')
      pdf.setTextColor(0, 0, 0)
      const display = orcidUrl ? `${authorName} iD` : authorName
      const displayWidth = pdf.getTextWidth(display)
      const startX = pageWidth / 2 - displayWidth / 2
      ensureSpace(16)
      pdf.text(authorName, startX, cursorY)
      if (orcidUrl) {
        const iconX = startX + pdf.getTextWidth(`${authorName} `)
        pdf.setTextColor(0xa6, 0xce, 0x39)
        setFont('bold')
        pdf.text('iD', iconX, cursorY)
        pdf.link(iconX, cursorY - 11, pdf.getTextWidth('iD'), 14, { url: orcidUrl })
        pdf.setTextColor(0, 0, 0)
      }
      cursorY += 22
    }

    const sections: Array<{ title: string; field: keyof Manuscript; keywordsLabel?: string; keywordsValue?: string }> =
      isEnglish
        ? [
            { title: 'Abstract', field: 'abstract', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
            { title: 'Introduction', field: 'introduction' },
            { title: 'Methods', field: 'methods' },
            { title: 'Results', field: 'results' },
            { title: 'Discussion', field: 'discussion' },
            { title: 'Conclusions', field: 'conclusions' },
          ]
        : [
            { title: 'Resumen', field: 'abstract', keywordsLabel: 'Palabras clave', keywordsValue: keywordsLine },
            { title: 'Abstract', field: 'abstractEn', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
            { title: 'Introducción', field: 'introduction' },
            { title: 'Métodos', field: 'methods' },
            { title: 'Resultados', field: 'results' },
            { title: 'Discusión', field: 'discussion' },
            { title: 'Conclusiones', field: 'conclusions' },
          ]

    for (const section of sections) {
      const content = String((manuscript as any)[section.field] ?? '')
      addHeading(section.title)
      addJustifiedParagraph(content)

      if (section.keywordsLabel) {
        setFont('bold')
        ensureSpace(16)
        pdf.text(`${section.keywordsLabel}:`, marginX, cursorY)
        cursorY += 16
        addJustifiedParagraph(section.keywordsValue || '—')
      }

      if (section.field === 'results') {
        addCaption(fig1Label)
        await addImageFromElement('phase7-fig-prisma')
        addSource()

        addCaption(table1Label)
        if (matrixRowCount) {
          await addMatrixFromElementPaged('phase7-table-matrix')
        } else {
          addJustifiedParagraph('(Sin datos)')
        }
        addSource()

        addCaption(fig2Label)
        await addImageFromElement('phase7-fig-by-year')
        addSource()

        addCaption(fig3Label)
        await addImageFromElement('phase7-fig-by-country')
        addSource()
      }
    }

    addHeading(isEnglish ? 'References' : 'Referencias')
    manuscript.references.forEach((reference, index) => addJustifiedParagraph(`${index + 1}. ${reference}`))

    pdf.save(`${baseName}.pdf`)
  }

  return (
    <>
      <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] px-4 py-3 flex flex-wrap gap-3 font-mono text-sm text-black">
        {onRegenerate ? (
          <button
            type="button"
            className="border-3 border-black px-4 py-2 bg-black text-white disabled:opacity-60"
            onClick={() => {
              setPendingLanguage('es')
              setShowLanguageModal(true)
            }}
            disabled={Boolean(regenerating) || downloading}
          >
            {regenerating ? '🤖 Regenerando…' : '🤖 Regenerar con IA (sobrescribir)'}
          </button>
        ) : null}
        <button
          type="button"
          className="border-3 border-black px-4 py-2 bg-[#EF4444] text-white disabled:opacity-60"
          onClick={handleWordExport}
          disabled={downloading}
        >
          📥 Exportar a Word (.docx)
        </button>
        <button
          type="button"
          className="border-3 border-black px-4 py-2 bg-white text-black"
          onClick={handleMarkdownExport}
        >
          📥 Exportar a Markdown (.md)
        </button>
        <button type="button" className="border-3 border-black px-4 py-2 bg-white text-black" onClick={handlePdfExport}>
          📥 Exportar a PDF
        </button>
      </div>

      {showLanguageModal ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[10px_10px_0_0_rgba(0,0,0,1)] max-w-lg w-full space-y-4">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-black">Idioma de la investigación</p>
            <h3 className="text-2xl font-black uppercase text-main">¿En qué idioma generar el informe?</h3>
            <p className="text-sm text-neutral-900 leading-relaxed">
              Esto sobrescribirá el contenido del manuscrito con IA. Las referencias no se modifican.
            </p>

            <div className="grid gap-3">
              <button
                type="button"
                className={`border-3 border-black px-4 py-3 font-mono text-sm text-left ${
                  pendingLanguage === 'es' ? 'bg-neutral-900 text-white' : 'bg-white text-black'
                }`}
                onClick={() => setPendingLanguage('es')}
              >
                Español (incluye también Abstract + Keywords en inglés)
              </button>
              <button
                type="button"
                className={`border-3 border-black px-4 py-3 font-mono text-sm text-left ${
                  pendingLanguage === 'en' ? 'bg-neutral-900 text-white' : 'bg-white text-black'
                }`}
                onClick={() => setPendingLanguage('en')}
              >
                English (full report in English)
              </button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row pt-2">
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-white text-black flex-1"
                onClick={() => setShowLanguageModal(false)}
                disabled={Boolean(regenerating)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-black text-white flex-1 disabled:opacity-60"
                onClick={async () => {
                  if (!onRegenerate) return
                  setShowLanguageModal(false)
                  await onRegenerate(pendingLanguage)
                }}
                disabled={Boolean(regenerating)}
              >
                {regenerating ? 'Regenerando…' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
